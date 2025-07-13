import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
import { getEmbeddings } from '../configs/langchain';
import { CacheService } from './cacheService';
import { prisma } from '../index';

export interface VectorStoreDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

// Helper to wrap async embedding for MemoryVectorStore with caching
function cachedEmbeddingWrapper() {
  return {
    embedDocuments: async (texts: string[]) => {
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        // Check cache first
        const cachedEmbedding = CacheService.getCachedEmbedding(text);
        if (cachedEmbedding) {
          embeddings.push(cachedEmbedding);
        } else {
          // Generate new embedding
          const result = await getEmbeddings([text]);
          const embedding = result[0];
          
          // Cache the embedding
          CacheService.cacheEmbedding(text, embedding);
          embeddings.push(embedding);
        }
      }
      
      return embeddings;
    },
    embedQuery: async (text: string) => {
      // Check cache first
      const cachedEmbedding = CacheService.getCachedEmbedding(text);
      if (cachedEmbedding) {
        return cachedEmbedding;
      }
      
      // Generate new embedding
      const result = await getEmbeddings([text]);
      const embedding = result[0];
      
      // Cache the embedding
      CacheService.cacheEmbedding(text, embedding);
      return embedding;
    }
  };
}

export class VectorStoreService {
  private static stores = new Map<string, MemoryVectorStore>();

  /**
   * Create or get vector store for a user
   */
  static async getVectorStore(userId: string, databaseId: string): Promise<MemoryVectorStore> {
    const key = `${userId}:${databaseId}`;
    
    if (!this.stores.has(key)) {
      this.stores.set(key, new MemoryVectorStore(cachedEmbeddingWrapper()));
    }
    
    return this.stores.get(key)!;
  }

  /**
   * Add documents to vector store
   */
  static async addDocuments(
    userId: string, 
    databaseId: string, 
    documents: VectorStoreDocument[]
  ): Promise<void> {
    try {
      const vectorStore = await this.getVectorStore(userId, databaseId);
      
      const langchainDocs = documents.map(doc => new Document({
        pageContent: doc.content,
        metadata: {
          id: doc.id,
          ...doc.metadata
        }
      }));

      await vectorStore.addDocuments(langchainDocs);
      
      console.log(`Added ${documents.length} documents to vector store for user ${userId}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error adding documents to vector store:', error.message);
      } else {
        console.error('Error adding documents to vector store:', error);
      }
      
      // Handle OpenAI quota errors gracefully
      if (error instanceof Error && (
        error.message.includes('429') || 
        error.message.includes('quota') || 
        error.message.includes('exceeded')
      )) {
        console.log('OpenAI text-embedding-3-small quota exceeded for vector store, skipping document addition...');
        return; // Skip vector store operations but don't fail the entire request
      }
      
      throw new Error('Failed to add documents to vector store');
    }
  }

  /**
   * Search for similar documents
   */
  static async similaritySearch(
    userId: string,
    databaseId: string,
    query: string,
    k: number = 5
  ): Promise<Document[]> {
    try {
      const vectorStore = await this.getVectorStore(userId, databaseId);
      const results = await vectorStore.similaritySearch(query, k);
      
      return results;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error searching vector store:', error.message);
      } else {
        console.error('Error searching vector store:', error);
      }
      
      // Handle OpenAI quota errors gracefully
      if (error instanceof Error && (
        error.message.includes('429') || 
        error.message.includes('quota') || 
        error.message.includes('exceeded')
      )) {
        console.log('OpenAI text-embedding-3-small quota exceeded for vector store search, returning empty results...');
        return []; // Return empty results instead of failing
      }
      
      throw new Error('Failed to search vector store');
    }
  }

  /**
   * Clear vector store for a user
   */
  static async clearVectorStore(userId: string, databaseId: string): Promise<void> {
    const key = `${userId}:${databaseId}`;
    this.stores.delete(key);
  }

  /**
   * Process query results and create embeddings
   */
  static async processQueryResults(
    userId: string,
    databaseId: string,
    queryResults: any[],
    question: string,
    query: string
  ): Promise<Document[]> {
    try {
      const documents: VectorStoreDocument[] = [];

      // Ensure queryResults is an array
      if (!Array.isArray(queryResults)) {
        console.warn('queryResults is not an array:', queryResults);
        queryResults = [];
      }

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
      const langchainDocs = documents.map(doc => new Document({
        pageContent: doc.content,
        metadata: doc.metadata
      }));

      return langchainDocs;
    } catch (error) {
      console.error('Error processing query results:', error);
      throw new Error('Failed to process query results');
    }
  }

  /**
   * Format row data for embedding
   */
  private static formatRowForEmbedding(row: any): string {
    if (!row || typeof row !== 'object') {
      return 'Invalid row data';
    }
    
    try {
      const entries = Object.entries(row);
      return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
    } catch (error) {
      console.error('Error formatting row for embedding:', error);
      return 'Error formatting row data';
    }
  }

  /**
   * Create summary content for embedding
   */
  private static createSummaryContent(results: any[], question: string): string {
    // Ensure results is an array
    if (!Array.isArray(results)) {
      results = [];
    }
    
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
  private static getNumericColumns(results: any[]): string[] {
    if (!Array.isArray(results) || results.length === 0) return [];

    const firstRow = results[0];
    if (!firstRow || typeof firstRow !== 'object') return [];

    return Object.entries(firstRow)
      .filter(([_, value]) => typeof value === 'number')
      .map(([key, _]) => key);
  }

  /**
   * Calculate basic metrics for numeric columns
   */
  private static calculateMetrics(results: any[], numericColumns: string[]): Record<string, any> {
    const metrics: Record<string, any> = {};

    if (!Array.isArray(results) || !Array.isArray(numericColumns)) {
      return metrics;
    }

    numericColumns.forEach(column => {
      const values = results
        .filter(row => row && typeof row === 'object')
        .map(row => row[column])
        .filter(val => typeof val === 'number');
      
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
  static async getRelevantContext(
    userId: string,
    databaseId: string,
    question: string,
    k: number = 3
  ): Promise<string> {
    try {
      const results = await this.similaritySearch(userId, databaseId, question, k);
      
      if (results.length === 0) {
        return 'No relevant context found.';
      }

      return results.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error getting relevant context:', error.message);
      } else {
        console.error('Error getting relevant context:', error);
      }
      return 'Error retrieving context.';
    }
  }
} 