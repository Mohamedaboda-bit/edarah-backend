import { Request, Response } from 'express';
import { getDashboardAnalysis } from '../utils/dashboardAnalysisService'
import { DatabaseConnectionService } from '../utils/databaseConnection';
import { executeDashboardAnalysis } from '../configs/langchain';
import { getUserDatabase } from '../utils/dashboardAnalysisService';
import { formatAITablePrompt } from '../configs/langchain';
import { openAIAnalysisLLM } from '../configs/langchain';
import { OpenAILLM } from '../configs/langchain';

// Protected endpoint: /api/dashboard/analysis
export const dashboardAnalysis = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: userId missing' });
    }
    // Optionally support databaseId override
    const databaseId = req.query.databaseId || req.body.databaseId;
    const result = await getDashboardAnalysis({ userId: userId.toString(), databaseId });
    
    if (result.insufficientData) {
      return res.status(200).json({ 
        message: 'Data from the database is not enough to analyze. You can go to the chatbot to ask about specifics.',
        reason: result.reason,
        dataSummary: result.dataSummary,
        sqlQuery: result.sqlQuery,
        rawData: result.rawData || []
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Dashboard analysis error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : error });
  }
}; 

// GET /api/dashboard/ai-table
export const getAITable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: userId missing' });
    }
    const databaseId = req.query.databaseId || req.body.databaseId;
    // Get user DB info
    const databaseInfo = await getUserDatabase(userId.toString(), databaseId);
    // Query all products with category, inventory, and sales info
    const query = `
      SELECT 
        p.product_id, p.name AS product_name, c.name AS category_name, p.price, p.cost_price,
        i.quantity_in_stock, i.last_restocked,
        COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
        COALESCE(SUM(oi.total_price), 0) AS total_revenue
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN order_items oi ON p.product_id = oi.product_id
      WHERE p.is_active = 1
      GROUP BY p.product_id, p.name, c.name, p.price, p.cost_price, i.quantity_in_stock, i.last_restocked
      ORDER BY p.product_id;
    `;
    const products = await DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, query);
    // Prepare data for AI analysis
    const aiPrompt = formatAITablePrompt({ data: JSON.stringify(products) });
    // Use gpt-4.1-mini for this endpoint only
    const aiResult = await new OpenAILLM('gpt-4.1-mini').call({ prompt: aiPrompt });
    let table;
    try {
      let responseText = aiResult.text;
      
      // Handle markdown-formatted JSON responses
      if (typeof responseText === 'string') {
        // Remove markdown code blocks
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        // Remove any leading/trailing whitespace
        responseText = responseText.trim();
      }
      
      table = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
    } catch (e) {
      console.error('JSON parsing error:', e);
      console.error('Raw LLM response:', aiResult.text);
      return res.status(500).json({ 
        message: 'AI response parsing failed', 
        error: e instanceof Error ? e.message : e,
        rawResponse: aiResult.text 
      });
    }
    return res.status(200).json({ data: table });
  } catch (error) {
    console.error('AI Table error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : error });
  }
}; 

export const analyzeProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    // Ensure userId is properly converted to string for BigInt operations
    const userIdString = userId.toString();
    const { productName, databaseId } = req.body;
    if (!productName) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }
    // 1. Get user's database info
    const { RAGService } = await import('../utils/ragService');
    const databaseInfo = await RAGService.getUserDatabase(userIdString, databaseId);
    // 2. Get schema
    const schema = await RAGService.getSchema(databaseInfo);
    const schemaDescription = RAGService.formatSchemaForPrompt(schema);
    // 3. LLM: Generate SQL query for all product data
    const { openAIQueryLLM, openAIAnalysisLLM } = await import('../configs/langchain');
    let dbInstructions = '';
    if (schema.databaseType === 'mysql') {
      dbInstructions = `\n- Use only MySQL 8.0 compatible syntax.\n- Do not use multiple CTEs (WITH ... AS ...), use subqueries if needed.\n- Do not include explanations or comments, only the SQL statement.\n- ONLY generate SELECT queries, NEVER INSERT, UPDATE, or DELETE operations.\n- Do not use double quotes for table or column names. Use backticks or no quotes.\n- For order status, use actual values from the database: 'delivered', 'shipped', 'processing', etc. Do NOT use 'Completed'. If unsure, use IN ('delivered', 'shipped', 'processing').`;
    }
    const sqlPrompt = `You are a SQL expert. Generate a MySQL 8.0 compatible SQL query to extract all available data for the product named '${productName}' from every relevant table in the provided schema. Include sales, prices, inventory, reviews, expiry, and any other related data. Use only SELECT statements. Do not use multiple CTEs or double quotes.\n\nDatabase Schema:\n${schemaDescription}${dbInstructions}`;
    let sqlResult, sqlQuery, queryResult = [];
    try {
      sqlResult = await openAIQueryLLM.call({ prompt: sqlPrompt });
      sqlQuery = sqlResult.text.trim().replace(/```sql|```/gi, '').trim();
      const sqlMatch = sqlQuery.match(/SELECT[\s\S]*/i);
      if (sqlMatch) {
        sqlQuery = sqlMatch[0].trim();
      } else {
        throw new Error('Only SELECT queries are allowed for product analysis.');
      }
      if (schema.databaseType === 'mysql') {
        sqlQuery = sqlQuery.replace(/"/g, '`');
      }
      queryResult = await (await import('../utils/databaseConnection')).DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, sqlQuery);
    } catch (error) {
      // Retry with explicit alias/column instructions
      const errorMsg = error instanceof Error ? error.message : String(error);
      const fixPrompt = `${sqlPrompt}\n\nThe previous query failed with the following error for ${schema.databaseType}:\n${errorMsg}\nYou used an alias or column that does not exist or is not defined at the point of use. Double-check that all table aliases are defined before use, all columns referenced in JOINs exist in the correct tables, and fix any alias/column issues. Use only MySQL 8.0 compatible syntax. Do not use multiple CTEs. Do not use double quotes for table or column names. Use IN ('delivered','shipped','processing') for order status if needed.`;
      try {
        sqlResult = await openAIQueryLLM.call({ prompt: fixPrompt });
        sqlQuery = sqlResult.text.trim().replace(/```sql|```/gi, '').trim();
        const sqlMatch2 = sqlQuery.match(/SELECT[\s\S]*/i);
        if (sqlMatch2) {
          sqlQuery = sqlMatch2[0].trim();
        } else {
          throw new Error('Only SELECT queries are allowed for product analysis.');
        }
        if (schema.databaseType === 'mysql') {
          sqlQuery = sqlQuery.replace(/"/g, '`');
        }
        queryResult = await (await import('../utils/databaseConnection')).DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, sqlQuery);
      } catch (secondError) {
        // Fallback to a simple query
        let fallbackQuery = '';
        if (schema.tables.some(t => t.name === 'products')) {
          fallbackQuery = `SELECT * FROM products WHERE name = '${productName}' LIMIT 1;`;
        } else if (schema.tables.some(t => t.name === 'services')) {
          fallbackQuery = `SELECT * FROM services WHERE name = '${productName}' LIMIT 1;`;
        } else {
          fallbackQuery = 'SELECT * FROM information_schema.tables LIMIT 1;';
        }
        try {
          queryResult = await (await import('../utils/databaseConnection')).DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, fallbackQuery);
        } catch (finalError) {
          return res.status(500).json({ success: false, error: 'Failed to analyze product', message: finalError instanceof Error ? finalError.message : 'Unknown error' });
        }
      }
    }
    // 4. LLM: Generate structured analysis for the frontend
    const analysisPrompt = `Based on the following product data, generate the following sections for the frontend:\n1. salesChart: Data suitable for plotting a sales chart (e.g., months, sales, profit/loss).\n2. prices: For each price found, return the price, date, and a suggested price (based on similar products on the internet and historical data).\n3. expectedSales: Total expected revenue, expected rate (+/-%), most likely sales time (e.g., weekend, seasonal), and expected units sold.\n4. warning: Type, short notice, and a suggestion.\n5. smartSuggestions: 3-5 actionable suggestions, each with a title, a one-sentence description, and a list of benefits.\nFormat each section as a JSON object or array, matching the frontend structure in the provided example. Do not return markdown or explanations—just the structured JSON.\n\nProduct Data:\n${JSON.stringify(queryResult)}`;
    const analysisResult = await openAIAnalysisLLM.call({ prompt: analysisPrompt });
    let structured;
    try {
      let responseText = analysisResult.text;
      
      // Handle markdown-formatted JSON responses
      if (typeof responseText === 'string') {
        // Remove markdown code blocks
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        // Remove any leading/trailing whitespace
        responseText = responseText.trim();
      }
      
      structured = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
    } catch (e) {
      console.error('JSON parsing error:', e);
      console.error('Raw LLM response:', analysisResult.text);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to parse LLM response', 
        message: e instanceof Error ? e.message : e,
        rawResponse: analysisResult.text 
      });
    }
    return res.status(200).json({ success: true, data: structured });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to analyze product', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}; 