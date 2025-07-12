import { UserRole } from '@prisma/client';
export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phoneNumber: string;
}
export declare class AuthUtils {
    private static readonly SALT_ROUNDS;
    private static readonly JWT_SECRET;
    private static readonly JWT_EXPIRES_IN;
    /**
     * Hash a password using bcrypt
     */
    static hashPassword(password: string): Promise<string>;
    /**
     * Compare a plain text password with a hashed password
     */
    static comparePassword(password: string, hashedPassword: string): Promise<boolean>;
    /**
     * Generate a JWT token
     */
    static generateToken(payload: JWTPayload): string;
    /**
     * Verify and decode a JWT token
     */
    static verifyToken(token: string): JWTPayload;
    /**
     * Extract token from Authorization header
     */
    static extractTokenFromHeader(authHeader: string | undefined): string | null;
}
//# sourceMappingURL=auth.d.ts.map