"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireAdmin = exports.authorizeRoles = exports.authenticateToken = void 0;
const auth_1 = require("../utils/auth");
const client_1 = require("@prisma/client");
/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = (req, res, next) => {
    try {
        const token = auth_1.AuthUtils.extractTokenFromHeader(req.headers.authorization);
        if (!token) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'No token provided'
            });
        }
        const decoded = auth_1.AuthUtils.verifyToken(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({
            error: 'Invalid token',
            message: 'Token is invalid or expired'
        });
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Middleware to authorize specific roles
 */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Authentication required'
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
/**
 * Middleware to check if user is admin
 */
exports.requireAdmin = (0, exports.authorizeRoles)(client_1.UserRole.admin);
/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = (req, res, next) => {
    try {
        const token = auth_1.AuthUtils.extractTokenFromHeader(req.headers.authorization);
        if (token) {
            const decoded = auth_1.AuthUtils.verifyToken(token);
            req.user = decoded;
        }
        next();
    }
    catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map