import express from 'express';
import * as planController from '../controllers/plan.controller';
import { requireAdmin,authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';
import { prisma } from '..';
import { success, error } from "../utils/responseHandler";
const router = express.Router();


router.post('/buy/:id', authenticateToken,async(req:Request,res:Response)=>{
    const user_id = req.user
    const id = Number(req.params.id);
    console.log(id)
    const plan = await prisma.plans.findFirst({
      where: { id }
    });
    if (plan){

    }else{
        return error(res,"plan id not found",404);
    }
    
});


router.post('/addPlan', authenticateToken,requireAdmin, planController.addPlan);

router.get('/listPlans', planController.listPlans);


export default router;


