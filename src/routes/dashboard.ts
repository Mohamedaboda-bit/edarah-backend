import { Router } from 'express';
import { dashboardAnalysis, getAITable } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/analysis (protected)
router.get('/analysis', authenticateToken, dashboardAnalysis);
// GET /api/dashboard/ai-table (protected)
router.get('/ai-table', authenticateToken, getAITable);

export default router; 