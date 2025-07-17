import { Router } from 'express';
import { dashboardAnalysis, getAITable, analyzeProduct } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/analysis (protected)
router.get('/analysis', authenticateToken, dashboardAnalysis);
// GET /api/dashboard/ai-table (protected)
router.get('/ai-table', authenticateToken, getAITable);

// Product analysis endpoint
router.post('/product-analysis', authenticateToken, analyzeProduct);

export default router; 