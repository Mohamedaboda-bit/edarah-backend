"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const AuthController = __importStar(require("../controllers/auth.controller"));
const router = express_1.default.Router();
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
router.get('/me', auth_1.authenticateToken, AuthController.getProfile);
/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', auth_1.authenticateToken, AuthController.logout);
/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', auth_1.authenticateToken, AuthController.refreshToken);
exports.default = router;
//# sourceMappingURL=auth.js.map