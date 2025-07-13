import { Request, Response } from 'express';
import { getDashboardAnalysis } from '../utils/dashboardAnalysisService'

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