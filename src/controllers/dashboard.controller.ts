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
    const result = await getDashboardAnalysis({ userId, databaseId });
    
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
    const databaseInfo = await getUserDatabase(userId, databaseId);
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
      table = typeof aiResult.text === 'string' ? JSON.parse(aiResult.text) : aiResult.text;
    } catch (e) {
      return res.status(500).json({ message: 'AI response parsing failed', error: e instanceof Error ? e.message : e });
    }
    return res.status(200).json({ data: table });
  } catch (error) {
    console.error('AI Table error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : error });
  }
}; 