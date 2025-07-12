import { Router } from 'express';
import { dashboardAnalysis } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/analysis (protected)
router.get('/analysis', authenticateToken, dashboardAnalysis);

export default router; 