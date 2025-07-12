import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../utils/auth';
import { UserRole } from '@prisma/client';
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}
/**
 * Middleware to authenticate JWT tokens
 */
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
/**
 * Middleware to authorize specific roles
 */
export declare const authorizeRoles: (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
/**
 * Middleware to check if user is admin
 */
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map