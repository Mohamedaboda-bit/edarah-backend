import { DatabaseConnectionService } from './databaseConnection';
import { PROMPT_TEMPLATES, executeSQLGeneration, executeDashboardAnalysis } from '../configs/langchain';
import { prisma } from '../index';

interface DashboardAnalysisParams {
  userId: string;
  databaseId?: string;
}

interface AnalysisResult {
  insufficientData: boolean;
  reason?: string;
  dataSummary?: {
    totalProducts: number;
    totalCategories: number;
    totalSuppliers: number;
    totalSales: number;
    hasStockData: boolean;
    hasExpiryData: boolean;
    hasReviewData: boolean;
  };
  sqlQuery?: string;
  dashboardData?: any;
  rawData?: any[];
  error?: string;
}

export async function getUserDatabase(userId: string, databaseId?: string) {
  let userDatabase;
  if (databaseId) {
    userDatabase = await prisma.user_databases.findFirst({
      where: { id: BigInt(databaseId), user_id: BigInt(userId), is_active: true }
    });
  } else {
    userDatabase = await prisma.user_databases.findFirst({
      where: { user_id: BigInt(userId), is_active: true }
    });
  }
  if (!userDatabase) throw new Error('No active database found for user');
  return {
    id: userDatabase.id.toString(),
    name: userDatabase.database_name || 'Unknown',
    type: userDatabase.database_type,
    connectionString: userDatabase.connection_string
  };
}

function cleanSQLQuery(sqlQuery: string): string {
  // Remove markdown code blocks (```sql ... ```)
  let cleaned = sqlQuery.replace(/```sql\s*/gi, '').replace(/```\s*$/gi, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Remove any remaining markdown formatting
  cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '');
  
  console.log(`[Dashboard Analysis] Cleaned SQL query:`, cleaned.substring(0, 200) + '...');
  
  return cleaned;
}

function analyzeDataSufficiency(data: any[]): { sufficient: boolean; reason?: string; summary: any } {
  console.log(`[Dashboard Analysis] Analyzing data sufficiency for ${data.length} records`);
  
  if (!data || data.length === 0) {
    return { 
      sufficient: false, 
      reason: 'No data returned from database query',
      summary: { totalProducts: 0, totalCategories: 0, totalSuppliers: 0, totalSales: 0, hasStockData: false, hasExpiryData: false, hasReviewData: false }
    };
  }

  // Analyze the data structure and content
  const sampleRecord = data[0];
  console.log(`[Dashboard Analysis] Sample record structure:`, Object.keys(sampleRecord));
  
  // Count unique values for different dimensions
  const uniqueProducts = new Set(data.map(row => row.product_id || row.id || row.productId)).size;
  const uniqueCategories = new Set(data.map(row => row.category_id || row.categoryId).filter(Boolean)).size;
  const uniqueSuppliers = new Set(data.map(row => row.supplier_id || row.supplierId).filter(Boolean)).size;
  
  // Calculate total sales - look for various possible column names
  const totalSales = data.reduce((sum, row) => {
    const salesValue = parseFloat(row.total_units_sold || row.total_sales || row.sales || row.quantity || 0) || 0;
    return sum + salesValue;
  }, 0);
  
  // Check for data quality indicators - look for various possible column names
  const hasStockData = data.some(row => 
    row.stock_level !== undefined || 
    row.quantity_in_stock !== undefined || 
    row.stock_quantity !== undefined || 
    row.quantity !== undefined
  );
  const hasExpiryData = data.some(row => row.expiry_date || row.expiration_date);
  const hasReviewData = data.some(row => row.review_count || row.rating || row.total_reviews);
  
  const summary = {
    totalProducts: uniqueProducts,
    totalCategories: uniqueCategories,
    totalSuppliers: uniqueSuppliers,
    totalSales: totalSales,
    hasStockData,
    hasExpiryData,
    hasReviewData
  };

  console.log(`[Dashboard Analysis] Data summary:`, summary);

  // Define sufficiency conditions
  const conditions = {
    hasProducts: uniqueProducts > 0,
    hasCategories: uniqueCategories > 0,
    hasSalesData: totalSales > 0 || data.some(row => 
      row.total_units_sold || 
      row.total_sales || 
      row.sales_amount || 
      row.revenue || 
      row.quantity
    ),
    hasBasicStructure: sampleRecord && Object.keys(sampleRecord).length > 2
  };

  console.log(`[Dashboard Analysis] Sufficiency conditions:`, conditions);

  // Determine if data is sufficient for analysis
  let sufficient = true;
  let reason = '';

  if (!conditions.hasProducts) {
    sufficient = false;
    reason = 'No products found in database';
  } else if (!conditions.hasBasicStructure) {
    sufficient = false;
    reason = 'Data structure is too simple for meaningful analysis';
  } else if (uniqueProducts < 3) {
    sufficient = false;
    reason = `Only ${uniqueProducts} products found - need at least 3 for meaningful analysis`;
  } else if (!conditions.hasSalesData && !hasStockData) {
    sufficient = false;
    reason = 'No sales or stock data available for analysis';
  }

  return { sufficient, reason, summary };
}

export async function getDashboardAnalysis({ userId, databaseId }: DashboardAnalysisParams): Promise<AnalysisResult> {
  console.log(`[Dashboard Analysis] Starting analysis for user ${userId}, database ${databaseId || 'default'}`);
  
  try {
    // 1. Get user DB info
    const databaseInfo = await getUserDatabase(userId, databaseId);
    console.log(`[Dashboard Analysis] Connected to database: ${databaseInfo.name} (${databaseInfo.type})`);

    // 2. Get schema
    const schema = await DatabaseConnectionService.getSchema(databaseInfo.connectionString, databaseInfo.type);
    console.log(`[Dashboard Analysis] Schema retrieved with ${schema.tables.length} tables`);

    // 3. Use LLM to generate the SQL query for analytics
    const analyticsQuestion = `Generate a SQL query to extract comprehensive product analytics data for a dashboard. The query should:

1. Include product details (id, name, sku, price, cost_price)
2. Include category and supplier information
3. Calculate total sales, revenue, and profit using SUM() aggregations
4. Include inventory stock levels
5. Include review counts and average ratings
6. Use proper GROUP BY clauses for MySQL ONLY_FULL_GROUP_BY mode
7. Join all relevant tables: products, categories, suppliers, order_items, orders, inventory, product_reviews
8. Filter for active products only
9. Order by total sales and profit for analysis

IMPORTANT: All non-aggregated columns in SELECT must be included in GROUP BY clause for MySQL compatibility.`;
    const sqlPrompt = PROMPT_TEMPLATES.formatSQLPrompt({
      schema: schema.tables.map(table => {
        const cols = table.columns.map(col => `${col.name} (${col.type})`).join(', ');
        return `Table: ${table.name}\nColumns: ${cols}`;
      }).join('\n\n'),
      question: analyticsQuestion,
      databaseType: schema.databaseType
    });
    
    console.log(`[Dashboard Analysis] Generating SQL query...`);
    const sqlResult = await executeSQLGeneration({
      schema: sqlPrompt,
      question: analyticsQuestion,
      databaseType: schema.databaseType
    });
    const rawSqlQuery = typeof sqlResult === 'string' ? sqlResult.trim() : sqlResult;
    console.log(`[Dashboard Analysis] Raw SQL query:`, rawSqlQuery.substring(0, 200) + '...');
    
    // Clean the SQL query to remove markdown formatting
    const sqlQuery = cleanSQLQuery(rawSqlQuery);

    // 4. Execute the AI-generated SQL query
    let queryResult: any[] = [];
    try {
      console.log(`[Dashboard Analysis] Executing SQL query...`);
      queryResult = await DatabaseConnectionService.executeQuery(
        databaseInfo.connectionString,
        databaseInfo.type,
        sqlQuery
      );
      console.log(`[Dashboard Analysis] Query executed successfully, returned ${queryResult.length} rows`);
    } catch (e) {
      console.error(`[Dashboard Analysis] SQL execution failed:`, e);
      
      // Try a fallback query if the AI-generated query fails
      console.log(`[Dashboard Analysis] Trying fallback query...`);
      const fallbackQuery = `
        SELECT 
          p.product_id,
          p.name AS product_name,
          p.sku,
          p.price,
          p.cost_price,
          c.name AS category_name,
          s.name AS supplier_name,
          COALESCE(SUM(oi.quantity), 0) AS total_sales,
          COALESCE(SUM(oi.total_price), 0) AS total_revenue,
          COALESCE(SUM(oi.total_price) - SUM(oi.quantity * p.cost_price), 0) AS total_profit,
          i.quantity_in_stock,
          COUNT(r.review_id) AS total_reviews,
          AVG(r.rating) AS average_rating
        FROM products p
        LEFT JOIN product_categories pc ON p.product_id = pc.product_id
        LEFT JOIN categories c ON pc.category_id = c.category_id
        LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
        LEFT JOIN order_items oi ON p.product_id = oi.product_id
        LEFT JOIN inventory i ON p.product_id = i.product_id
        LEFT JOIN product_reviews r ON p.product_id = r.product_id
        WHERE p.is_active = 1
        GROUP BY p.product_id, p.name, p.sku, p.price, p.cost_price, c.name, s.name, i.quantity_in_stock
        ORDER BY total_sales DESC, total_profit DESC
      `;
      
      try {
        queryResult = await DatabaseConnectionService.executeQuery(
          databaseInfo.connectionString,
          databaseInfo.type,
          fallbackQuery
        );
        console.log(`[Dashboard Analysis] Fallback query executed successfully, returned ${queryResult.length} rows`);
      } catch (fallbackError) {
        console.error(`[Dashboard Analysis] Fallback query also failed:`, fallbackError);
        return { 
          insufficientData: true, 
          reason: `SQL execution failed: ${e instanceof Error ? e.message : 'Unknown error'}. Fallback query also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
          error: 'SQL execution failed', 
          sqlQuery, 
          rawData: [],
          dataSummary: { totalProducts: 0, totalCategories: 0, totalSuppliers: 0, totalSales: 0, hasStockData: false, hasExpiryData: false, hasReviewData: false }
        };
      }
    }

    // 5. Analyze data sufficiency
    const sufficiencyAnalysis = analyzeDataSufficiency(queryResult);
    
    if (!sufficiencyAnalysis.sufficient) {
      console.log(`[Dashboard Analysis] Data insufficient: ${sufficiencyAnalysis.reason}`);
      return { 
        insufficientData: true, 
        reason: sufficiencyAnalysis.reason,
        sqlQuery, 
        rawData: queryResult,
        dataSummary: sufficiencyAnalysis.summary
      };
    }

    // 6. Use LLM to analyze the data and generate structured dashboard analytics
    console.log(`[Dashboard Analysis] Data sufficient, generating structured AI analysis...`);
    const aiAnalysis = await executeDashboardAnalysis({
      data: JSON.stringify(queryResult),
      context: 'E-commerce dashboard analysis with focus on products, categories, suppliers, sales performance, and inventory management',
      chatHistory: ''
    });

    console.log(`[Dashboard Analysis] Analysis completed successfully`);

    // 7. Parse the AI analysis response
    let parsedAnalysis;
    try {
      parsedAnalysis = typeof aiAnalysis === 'string' ? JSON.parse(aiAnalysis) : aiAnalysis;
      console.log(`[Dashboard Analysis] AI analysis parsed successfully`);
    } catch (error) {
      console.error(`[Dashboard Analysis] Failed to parse AI analysis:`, error);
      parsedAnalysis = { error: 'Failed to parse AI analysis response' };
    }

    // 8. Return the structured dashboard data
    return {
      insufficientData: false,
      sqlQuery,
      dashboardData: parsedAnalysis,
      rawData: queryResult,
      dataSummary: sufficiencyAnalysis.summary
    };
  } catch (error) {
    console.error(`[Dashboard Analysis] Unexpected error:`, error);
    return {
      insufficientData: true,
      reason: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      rawData: []
    };
  }
} 