import express from 'express';
import * as planController from '../controllers/plan.controller';
import { requireAdmin,authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';
import { prisma } from '..';
import { success, error } from "../utils/responseHandler";
import { buyPlan } from '../controllers/paymobController';
const router = express.Router();


router.post('/buy/:id', authenticateToken,buyPlan);

router.post('/addPlan', authenticateToken,requireAdmin, planController.addPlan);

router.get('/listPlans', planController.listPlans);


export default router;


