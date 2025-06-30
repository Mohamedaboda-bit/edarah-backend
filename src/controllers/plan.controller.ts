import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { ValidationUtils } from '../utils/validation';

const prisma = new PrismaClient();

export const addPlan = async (req: Request, res: Response) => {
    try {
        const validation = ValidationUtils.validateAddPlanInput(req.body);
        if (!validation.isValid) {
            return res.status(400).json({ errors: validation.errors });
        }

        const { name, features, price, is_active, token_limit } = req.body;
        
        const existingPlan = await prisma.plans.findFirst({
            where: { name: name }
        });

        if (existingPlan) {
            return res.status(409).json({ error: `Plan with name '${name}' already exists.` });
        }

        const newPlan = await prisma.plans.create({
            data: {
                name,
                features,
                price,
                is_active,
                token_limit,
            },
        });

        return res.status(201).json(newPlan);
    } catch (error) {
        console.error('Error creating plan:', error);
        return res.status(500).json({ error: 'Failed to create plan due to a server error.' });
    }
}


export const listPlans = async (req: Request, res: Response) => {
    try {
        const plans = await prisma.plans.findMany({
            where: {
                is_active: true
            }
        });
        return res.status(200).json(plans);
    } catch (error) {
        console.error('Error listing plans:', error);
        return res.status(500).json({ error: 'Failed to retrieve plans due to a server error.' });
    }
}





