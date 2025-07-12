import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
export interface VectorStoreDocument {
    id: string;
    content: string;
    metadata: Record<string, any>;
}
export declare class VectorStoreService {
    private static stores;
    /**
     * Create or get vector store for a user
     */
    static getVectorStore(userId: string, databaseId: string): Promise<MemoryVectorStore>;
    /**
     * Add documents to vector store
     */
    static addDocuments(userId: string, databaseId: string, documents: VectorStoreDocument[]): Promise<void>;
    /**
     * Search for similar documents
     */
    static similaritySearch(userId: string, databaseId: string, query: string, k?: number): Promise<Document[]>;
    /**
     * Clear vector store for a user
     */
    static clearVectorStore(userId: string, databaseId: string): Promise<void>;
    /**
     * Process query results and create embeddings
     */
    static processQueryResults(userId: string, databaseId: string, queryResults: any[], question: string, query: string): Promise<Document[]>;
    /**
     * Format row data for embedding
     */
    private static formatRowForEmbedding;
    /**
     * Create summary content for embedding
     */
    private static createSummaryContent;
    /**
     * Get numeric columns from results
     */
    private static getNumericColumns;
    /**
     * Calculate basic metrics for numeric columns
     */
    private static calculateMetrics;
    /**
     * Get relevant context for analysis
     */
    static getRelevantContext(userId: string, databaseId: string, question: string, k?: number): Promise<string>;
}
//# sourceMappingURL=vectorStore.d.ts.map