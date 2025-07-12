import { DatabaseConnectionService } from './databaseConnection';
import { PROMPT_TEMPLATES, executeSQLGeneration, executeBusinessAnalysis } from '../configs/langchain';
import { prisma } from '../index';

interface DashboardAnalysisParams {
  userId: string;
  databaseId?: string;
}

async function getUserDatabase(userId: string, databaseId?: string) {
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

export async function getDashboardAnalysis({ userId, databaseId }: DashboardAnalysisParams) {
  // 1. Get user DB info
  const databaseInfo = await getUserDatabase(userId, databaseId);

  // 2. Get schema
  const schema = await DatabaseConnectionService.getSchema(databaseInfo.connectionString, databaseInfo.type);

  // 3. Use LLM to generate the SQL query for analytics
  const analyticsQuestion = `Generate a SQL query to extract all data needed for a dashboard that analyzes products for: low sales, dead stock, expired, loss, best/worst performer, revenue, profit, month-over-month change, and includes category, supplier, sales, stock, expiry, margin, and reviews. Use the normalized e-commerce schema provided.`;
  const sqlPrompt = PROMPT_TEMPLATES.formatSQLPrompt({
    schema: schema.tables.map(table => {
      const cols = table.columns.map(col => `${col.name} (${col.type})`).join(', ');
      return `Table: ${table.name}\nColumns: ${cols}`;
    }).join('\n\n'),
    question: analyticsQuestion,
    databaseType: schema.databaseType
  });
  const sqlResult = await executeSQLGeneration({
    schema: sqlPrompt,
    question: analyticsQuestion,
    databaseType: schema.databaseType
  });
  const sqlQuery = typeof sqlResult === 'string' ? sqlResult.trim() : sqlResult;

  // 4. Execute the AI-generated SQL query
  let queryResult: any[] = [];
  try {
    queryResult = await DatabaseConnectionService.executeQuery(
      databaseInfo.connectionString,
      databaseInfo.type,
      sqlQuery
    );
  } catch (e) {
    return { insufficientData: true, error: 'SQL execution failed', sqlQuery, rawData: [] };
  }
  if (!queryResult || queryResult.length === 0) {
    return { insufficientData: true, error: 'No data returned from analytics query', sqlQuery, rawData: [] };
  }

  // 5. Use LLM to analyze the data and generate dashboard analytics/insights
  const analysisPrompt = PROMPT_TEMPLATES.formatBusinessAnalysisPrompt({
    question: 'Analyze this data for a dashboard: find top products for low sales, dead stock, expired, loss, best/worst performer, revenue, profit, month-over-month change, and provide general suggestions and insights.',
    data: JSON.stringify(queryResult),
    context: '',
    chatHistory: ''
  });
  const aiAnalysis = await executeBusinessAnalysis({
    question: 'Analyze this data for a dashboard: find top products for low sales, dead stock, expired, loss, best/worst performer, revenue, profit, month-over-month change, and provide general suggestions and insights.',
    data: JSON.stringify(queryResult),
    context: '',
    chatHistory: ''
  });

  // 6. Return the full AI-generated output and raw data
  return {
    insufficientData: false,
    sqlQuery,
    aiAnalysis,
    rawData: queryResult
  };
} 