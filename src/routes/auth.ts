import express from 'express';
import { authenticateToken } from '../middleware/auth';
import * as AuthController from '../controllers/auth.controller';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', AuthController.register);

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', AuthController.login);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, AuthController.getProfile);

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, AuthController.logout);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticateToken, AuthController.refreshToken);

export default router;

