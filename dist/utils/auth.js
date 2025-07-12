"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUtils = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthUtils {
    /**
     * Hash a password using bcrypt
     */
    static async hashPassword(password) {
        return bcryptjs_1.default.hash(password, this.SALT_ROUNDS);
    }
    /**
     * Compare a plain text password with a hashed password
     */
    static async comparePassword(password, hashedPassword) {
        return bcryptjs_1.default.compare(password, hashedPassword);
    }
    /**
     * Generate a JWT token
     */
    static generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.JWT_SECRET, {
            expiresIn: this.JWT_EXPIRES_IN,
        });
    }
    /**
     * Verify and decode a JWT token
     */
    static verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
    }
    /**
     * Extract token from Authorization header
     */
    static extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7); // Remove 'Bearer ' prefix
    }
}
exports.AuthUtils = AuthUtils;
AuthUtils.SALT_ROUNDS = 12;
AuthUtils.JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
AuthUtils.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
//# sourceMappingURL=auth.js.map