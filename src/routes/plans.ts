import express from 'express';

import { Request, Response } from 'express';

const router = express.Router();


router.post('/buyPlan', async(req:Request,res:Response)=>{
    console.log(req.body)
    res.status(200)
});



export default router;

