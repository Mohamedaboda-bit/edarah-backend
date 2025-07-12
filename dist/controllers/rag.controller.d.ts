import { Request, Response } from 'express';
export declare class RAGController {
    /**
     * Analyze business data and provide insights
     */
    static analyzeData(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Add or update database connection
     */
    static connectDatabase(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get user's databases
     */
    static getUserDatabases(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get database schema
     */
    static getDatabaseSchema(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Remove database connection
     */
    static removeDatabase(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get rate limit information
     */
    static getRateLimitInfo(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get historical context from vector store
     */
    static getHistoricalContext(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Clear vector store for a database
     */
    static clearVectorStore(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get current user's conversation memory
     */
    static getUserMemory(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Clear current user's conversation memory
     */
    static clearUserMemory(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get current user's conversation history
     */
    static getConversationHistory(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=rag.controller.d.ts.map