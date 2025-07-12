import { DatabaseSchema } from './databaseConnection';
import { BufferMemory } from 'langchain/memory';
export interface RAGRequest {
    question: string;
    userId: string;
    databaseId?: string;
    context?: string;
}
export interface RAGResponse {
    insights: string;
    recommendations: string[];
    dataSummary: {
        totalRecords: number;
        keyMetrics: Record<string, any>;
    };
    query?: string;
    confidence: number;
    databaseInfo?: {
        name: string;
        type: string;
    };
}
export interface DatabaseInfo {
    id: string;
    name: string;
    type: string;
    connectionString: string;
}
declare const userMemories: Map<string, BufferMemory>;
declare function getUserMemory(userId: string): BufferMemory;
declare function clearUserMemory(userId: string): void;
/**
 * Load conversation history from user memory
 */
declare function loadConversationHistory(userId: string): Promise<string>;
/**
 * Save conversation to user memory
 */
declare function saveConversation(userId: string, question: string, response: string): Promise<void>;
export { getUserMemory, clearUserMemory, userMemories, loadConversationHistory, saveConversation };
export declare class RAGService {
    /**
     * Process general knowledge request (no database needed)
     */
    private static processGeneralRequest;
    /**
     * Process database request (existing RAG flow)
     */
    private static processDatabaseRequest;
    /**
     * Process RAG request with smart question classification
     */
    static processRequest(request: RAGRequest): Promise<RAGResponse>;
    /**
     * Get user's database information
     */
    private static getUserDatabase;
    /**
     * Get or refresh database schema
     */
    private static getSchema;
    /**
     * Generate SQL query using LangChain
     */
    private static generateSQLQuery;
    /**
     * Execute SQL query
     */
    private static executeQuery;
    /**
     * Generate business insights using LangChain with vector store context
     */
    private static generateInsights;
    /**
     * Format schema for AI prompt
     */
    private static formatSchemaForPrompt;
    /**
     * Format data for AI prompt
     */
    private static formatDataForPrompt;
    /**
     * Fix PostgreSQL table names to be properly quoted for case sensitivity
     */
    private static fixPostgreSQLTableNames;
    /**
     * Fix PostgreSQL enum comparisons to use proper casting
     */
    private static fixPostgreSQLEnumComparisons;
    /**
     * Basic SQL syntax validation and fixing
     */
    private static validateAndFixSQLSyntax;
    /**
     * Remove WHERE conditions that might filter out all data
     */
    private static removeProblematicWhereConditions;
    /**
     * Generate a simple fallback query when complex queries return no results
     */
    private static generateSimpleFallbackQuery;
    /**
     * Analyze database schema to determine business type using LangChain
     */
    static analyzeBusinessType(schema: DatabaseSchema): Promise<{
        businessType: string;
        entities: string[];
        processes: string[];
        analysisOpportunities: string[];
    }>;
    /**
     * Get historical context from vector store
     */
    static getHistoricalContext(userId: string, databaseId: string, question: string): Promise<string>;
    /**
     * Clear vector store for a user
     */
    static clearUserVectorStore(userId: string, databaseId: string): Promise<void>;
}
//# sourceMappingURL=ragService.d.ts.map