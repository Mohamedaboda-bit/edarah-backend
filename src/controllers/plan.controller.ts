import { PrismaClient, UserRole } from '@prisma/client';
import { AuthUtils } from '../utils/auth';
import { ValidationUtils } from '../utils/validation';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export const addPlan = async (req: Request, res: Response) => {

}

