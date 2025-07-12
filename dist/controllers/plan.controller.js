"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlans = exports.addPlan = void 0;
const client_1 = require("@prisma/client");
const validation_1 = require("../utils/validation");
const prisma = new client_1.PrismaClient();
const addPlan = async (req, res) => {
    try {
        const validation = validation_1.ValidationUtils.validateAddPlanInput(req.body);
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
    }
    catch (error) {
        console.error('Error creating plan:', error);
        return res.status(500).json({ error: 'Failed to create plan due to a server error.' });
    }
};
exports.addPlan = addPlan;
const listPlans = async (req, res) => {
    try {
        const plans = await prisma.plans.findMany({
            where: {
                is_active: true
            }
        });
        return res.status(200).json(plans);
    }
    catch (error) {
        console.error('Error listing plans:', error);
        return res.status(500).json({ error: 'Failed to retrieve plans due to a server error.' });
    }
};
exports.listPlans = listPlans;
//# sourceMappingURL=plan.controller.js.map