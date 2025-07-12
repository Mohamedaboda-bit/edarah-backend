"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStoreService = void 0;
const memory_1 = require("langchain/vectorstores/memory");
const document_1 = require("langchain/document");
const langchain_1 = require("../configs/langchain");
// Helper to wrap async embedding for MemoryVectorStore
function huggingFaceEmbeddingWrapper() {
    return {
        embedDocuments: async (texts) => {
            return await (0, langchain_1.getEmbeddings)(texts);
        },
        embedQuery: async (text) => {
            const result = await (0, langchain_1.getEmbeddings)([text]);
            return result[0];
        }
    };
}
class VectorStoreService {
    /**
     * Create or get vector store for a user
     */
    static async getVectorStore(userId, databaseId) {
        const key = `${userId}:${databaseId}`;
        if (!this.stores.has(key)) {
            this.stores.set(key, new memory_1.MemoryVectorStore(huggingFaceEmbeddingWrapper()));
        }
        return this.stores.get(key);
    }
    /**
     * Add documents to vector store
     */
    static async addDocuments(userId, databaseId, documents) {
        try {
            const vectorStore = await this.getVectorStore(userId, databaseId);
            const langchainDocs = documents.map(doc => new document_1.Document({
                pageContent: doc.content,
                metadata: {
                    id: doc.id,
                    ...doc.metadata
                }
            }));
            await vectorStore.addDocuments(langchainDocs);
            console.log(`Added ${documents.length} documents to vector store for user ${userId}`);
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error adding documents to vector store:', error.message);
            }
            else {
                console.error('Error adding documents to vector store:', error);
            }
            // Handle OpenAI quota errors gracefully
            if (error instanceof Error && (error.message.includes('429') ||
                error.message.includes('quota') ||
                error.message.includes('exceeded'))) {
                console.log('OpenAI quota exceeded for vector store, skipping document addition...');
                return; // Skip vector store operations but don't fail the entire request
            }
            throw new Error('Failed to add documents to vector store');
        }
    }
    /**
     * Search for similar documents
     */
    static async similaritySearch(userId, databaseId, query, k = 5) {
        try {
            const vectorStore = await this.getVectorStore(userId, databaseId);
            const results = await vectorStore.similaritySearch(query, k);
            return results;
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error searching vector store:', error.message);
            }
            else {
                console.error('Error searching vector store:', error);
            }
            // Handle OpenAI quota errors gracefully
            if (error instanceof Error && (error.message.includes('429') ||
                error.message.includes('quota') ||
                error.message.includes('exceeded'))) {
                console.log('OpenAI quota exceeded for vector store search, returning empty results...');
                return []; // Return empty results instead of failing
            }
            throw new Error('Failed to search vector store');
        }
    }
    /**
     * Clear vector store for a user
     */
    static async clearVectorStore(userId, databaseId) {
        const key = `${userId}:${databaseId}`;
        this.stores.delete(key);
    }
    /**
     * Process query results and create embeddings
     */
    static async processQueryResults(userId, databaseId, queryResults, question, query) {
        try {
            const documents = [];
            // Create documents from query results
            queryResults.forEach((row, index) => {
                const content = this.formatRowForEmbedding(row);
                documents.push({
                    id: `result_${index}`,
                    content,
                    metadata: {
                        type: 'query_result',
                        rowIndex: index,
                        question,
                        query,
                        timestamp: new Date().toISOString()
                    }
                });
            });
            // Add summary document
            const summaryContent = this.createSummaryContent(queryResults, question);
            documents.push({
                id: 'summary',
                content: summaryContent,
                metadata: {
                    type: 'summary',
                    question,
                    query,
                    totalRecords: queryResults.length,
                    timestamp: new Date().toISOString()
                }
            });
            // Convert to LangChain documents
            const langchainDocs = documents.map(doc => new document_1.Document({
                pageContent: doc.content,
                metadata: doc.metadata
            }));
            return langchainDocs;
        }
        catch (error) {
            console.error('Error processing query results:', error);
            throw new Error('Failed to process query results');
        }
    }
    /**
     * Format row data for embedding
     */
    static formatRowForEmbedding(row) {
        const entries = Object.entries(row);
        return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
    }
    /**
     * Create summary content for embedding
     */
    static createSummaryContent(results, question) {
        const totalRecords = results.length;
        if (totalRecords === 0) {
            return `No data found for the question: "${question}". Query returned 0 records.`;
        }
        // Extract key metrics from results
        const numericColumns = this.getNumericColumns(results);
        const metrics = this.calculateMetrics(results, numericColumns);
        return `
Question: ${question}
Total Records: ${totalRecords}
Key Metrics: ${Object.entries(metrics).map(([key, value]) => `${key}: ${value}`).join(', ')}
Data Summary: Analysis of ${totalRecords} records with ${numericColumns.length} numeric columns.
    `.trim();
    }
    /**
     * Get numeric columns from results
     */
    static getNumericColumns(results) {
        if (results.length === 0)
            return [];
        const firstRow = results[0];
        return Object.entries(firstRow)
            .filter(([_, value]) => typeof value === 'number')
            .map(([key, _]) => key);
    }
    /**
     * Calculate basic metrics for numeric columns
     */
    static calculateMetrics(results, numericColumns) {
        const metrics = {};
        numericColumns.forEach(column => {
            const values = results.map(row => row[column]).filter(val => typeof val === 'number');
            if (values.length > 0) {
                const sum = values.reduce((a, b) => a + b, 0);
                const avg = sum / values.length;
                const max = Math.max(...values);
                const min = Math.min(...values);
                metrics[`${column}_sum`] = sum;
                metrics[`${column}_avg`] = avg;
                metrics[`${column}_max`] = max;
                metrics[`${column}_min`] = min;
            }
        });
        return metrics;
    }
    /**
     * Get relevant context for analysis
     */
    static async getRelevantContext(userId, databaseId, question, k = 3) {
        try {
            const results = await this.similaritySearch(userId, databaseId, question, k);
            if (results.length === 0) {
                return 'No relevant context found.';
            }
            return results.map(doc => doc.pageContent).join('\n\n');
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error getting relevant context:', error.message);
            }
            else {
                console.error('Error getting relevant context:', error);
            }
            return 'Error retrieving context.';
        }
    }
}
exports.VectorStoreService = VectorStoreService;
VectorStoreService.stores = new Map();
//# sourceMappingURL=vectorStore.js.map