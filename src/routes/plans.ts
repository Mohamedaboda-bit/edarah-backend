import express from 'express';
import * as planController from '../controllers/plan.controller';

import { Request, Response } from 'express';

const router = express.Router();


router.post('/buyPlan', async(req:Request,res:Response)=>{
    console.log(req.body)
    res.status(200)
});


router.post('/addPlan', planController.addPlan);


export default router;


