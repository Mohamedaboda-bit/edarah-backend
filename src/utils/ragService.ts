import { executeSQLGeneration, executeBusinessAnalysis, executeSchemaAnalysis } from '../configs/langchain';
import { DatabaseConnectionService, DatabaseSchema } from './databaseConnection';
import { VectorStoreService } from './vectorStore';
import { EncryptionService } from './encryption';
import { prisma } from '../index';

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
  sqlQuery?: string;
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

export class RAGService {
  /**
   * Process RAG request with vector store integration
   */
  static async processRequest(request: RAGRequest): Promise<RAGResponse> {
    try {
      // Step 1: Get user's database information
      const databaseInfo = await this.getUserDatabase(request.userId, request.databaseId);
      
      // Step 2: Get or refresh schema
      const schema = await this.getSchema(databaseInfo);
      
      // Step 3: Generate SQL query using LangChain
      const sqlQuery = await this.generateSQLQuery(request.question, schema);
      
      // Step 4: Execute query
      const queryResult = await this.executeQuery(databaseInfo, sqlQuery);
      
      // Step 5: Process results and add to vector store
      const documents = await VectorStoreService.processQueryResults(
        request.userId,
        databaseInfo.id,
        queryResult,
        request.question,
        sqlQuery
      );
      
      // Step 6: Add documents to vector store (skip if quota exceeded)
      try {
        await VectorStoreService.addDocuments(request.userId, databaseInfo.id, 
          documents.map(doc => ({
            id: doc.metadata.id || 'unknown',
            content: doc.pageContent,
            metadata: doc.metadata
          }))
        );
      } catch (error) {
        console.log('Vector store document addition failed, continuing without it...');
      }
      
      // Step 7: Get relevant context from vector store (skip if quota exceeded)
      let relevantContext = '';
      try {
        relevantContext = await VectorStoreService.getRelevantContext(
          request.userId,
          databaseInfo.id,
          request.question
        );
      } catch (error) {
        console.log('Vector store context retrieval failed, continuing without it...');
        relevantContext = 'No historical context available due to quota limits.';
      }
      
      // Step 8: Generate insights using LangChain with vector store context
      const insights = await this.generateInsights(
        request.question, 
        queryResult, 
        request.context,
        relevantContext
      );
      
      // Step 9: Return complete response
      return {
        ...insights,
        sqlQuery,
        databaseInfo: {
          name: databaseInfo.name,
          type: databaseInfo.type
        }
      };
    } catch (error) {
      console.error('RAG processing error:', error);
      throw error;
    }
  }

  /**
   * Get user's database information
   */
  private static async getUserDatabase(userId: string, databaseId?: string): Promise<DatabaseInfo> {
    try {
      let userDatabase;
      
      if (databaseId) {
        // Get specific database
        userDatabase = await prisma.user_databases.findFirst({
          where: {
            id: BigInt(databaseId),
            user_id: BigInt(userId),
            is_active: true
          }
        });
      } else {
        // Get first active database
        userDatabase = await prisma.user_databases.findFirst({
          where: {
            user_id: BigInt(userId),
            is_active: true
          }
        });
      }

      if (!userDatabase) {
        throw new Error('No active database found for user');
      }

      return {
        id: userDatabase.id.toString(),
        name: userDatabase.database_name || 'Unknown',
        type: userDatabase.database_type,
        connectionString: userDatabase.connection_string
      };
    } catch (error) {
      throw new Error(`Failed to get user database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or refresh database schema
   */
  private static async getSchema(databaseInfo: DatabaseInfo): Promise<DatabaseSchema> {
    try {
      // Check if we have a cached schema that's not too old (weekly refresh)
      const userDatabase = await prisma.user_databases.findUnique({
        where: { id: BigInt(databaseInfo.id) }
      });

      if (userDatabase?.schema_cache) {
        const lastUpdate = userDatabase.last_schema_update;
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        
        if (Date.now() - lastUpdate.getTime() < weekInMs) {
          // Use cached schema
          return userDatabase.schema_cache as unknown as DatabaseSchema;
        }
      }

      // Get fresh schema
      const schema = await DatabaseConnectionService.getSchema(
        databaseInfo.connectionString,
        databaseInfo.type
      );

      // Update cache
      await prisma.user_databases.update({
        where: { id: BigInt(databaseInfo.id) },
        data: {
          schema_cache: schema as any,
          last_schema_update: new Date()
        }
      });

      return schema;
    } catch (error) {
      throw new Error(`Failed to get schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate SQL query using LangChain
   */
  private static async generateSQLQuery(question: string, schema: DatabaseSchema): Promise<string> {
    try {
      const schemaDescription = this.formatSchemaForPrompt(schema);
      
      const result = await executeSQLGeneration({
        schema: schemaDescription,
        question: question,
        databaseType: schema.databaseType
      });

      if (!result) {
        throw new Error('Failed to generate SQL query');
      }

      return result.trim();
    } catch (error) {
      console.error('Error generating SQL query:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exceeded')) {
          throw new Error('OpenAI quota exceeded. Please check your billing and quota limits.');
        } else if (error.message.includes('model') || error.message.includes('gpt')) {
          throw new Error('OpenAI model configuration error. Please check your API key and model access.');
        } else if (error.message.includes('API key')) {
          throw new Error('OpenAI API key is invalid or missing. Please check your environment variables.');
        } else {
          throw new Error(`Failed to generate SQL query: ${error.message}`);
        }
      }
      
      throw new Error('Failed to generate SQL query');
    }
  }

  /**
   * Execute SQL query
   */
  private static async executeQuery(databaseInfo: DatabaseInfo, sqlQuery: string): Promise<any[]> {
    try {
      return await DatabaseConnectionService.executeQuery(
        databaseInfo.connectionString,
        databaseInfo.type,
        sqlQuery
      );
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate business insights using LangChain with vector store context
   */
  private static async generateInsights(
    question: string, 
    data: any[], 
    context?: string,
    vectorContext?: string
  ): Promise<Omit<RAGResponse, 'sqlQuery' | 'databaseInfo'>> {
    try {
      const dataContext = this.formatDataForPrompt(data);
      const combinedContext = [context, vectorContext].filter(Boolean).join('\n\n');
      
      const result = await executeBusinessAnalysis({
        question: question,
        data: dataContext,
        context: combinedContext || 'No additional context provided'
      });

      if (!result) {
        throw new Error('Failed to generate insights');
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(result);
        return {
          insights: parsed.insights || 'Analysis completed successfully.',
          recommendations: parsed.recommendations || [],
          dataSummary: parsed.dataSummary || { totalRecords: data.length, keyMetrics: {} },
          confidence: parsed.confidence || 7,
        };
      } catch (parseError) {
        // If JSON parsing fails, return the raw response
        return {
          insights: result,
          recommendations: ['Review the analysis for specific recommendations'],
          dataSummary: { totalRecords: data.length, keyMetrics: {} },
          confidence: 5,
        };
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new Error('Failed to generate insights');
    }
  }

  /**
   * Format schema for AI prompt
   */
  private static formatSchemaForPrompt(schema: DatabaseSchema): string {
    return schema.tables.map(table => {
      const columns = table.columns.map(col => 
        `${col.name} (${col.type})${col.isPrimaryKey ? ' [PRIMARY KEY]' : ''}${col.isNullable ? '' : ' [NOT NULL]'}`
      ).join(', ');
      
      return `Table: ${table.name}\nColumns: ${columns}`;
    }).join('\n\n');
  }

  /**
   * Format data for AI prompt
   */
  private static formatDataForPrompt(data: any[]): string {
    if (!data || data.length === 0) {
      return 'No data found for the query.';
    }

    // Convert each row to a readable text format
    const formattedRows = data.map((row, index) => {
      const rowText = Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      return `Record ${index + 1}: ${rowText}`;
    });

    return formattedRows.join('\n\n') + `\n\nSummary: Found ${data.length} records`;
  }

  /**
   * Analyze database schema to determine business type using LangChain
   */
  static async analyzeBusinessType(schema: DatabaseSchema): Promise<{
    businessType: string;
    entities: string[];
    processes: string[];
    analysisOpportunities: string[];
  }> {
    try {
      const schemaDescription = this.formatSchemaForPrompt(schema);
      
      const result = await executeSchemaAnalysis({
        schema: schemaDescription
      });

      if (!result) {
        throw new Error('Failed to analyze business type');
      }

      try {
        return JSON.parse(result);
      } catch (parseError) {
        // Fallback response
        return {
          businessType: 'unknown',
          entities: [],
          processes: [],
          analysisOpportunities: []
        };
      }
    } catch (error) {
      console.error('Error analyzing business type:', error);
      throw new Error('Failed to analyze business type');
    }
  }

  /**
   * Get historical context from vector store
   */
  static async getHistoricalContext(userId: string, databaseId: string, question: string): Promise<string> {
    try {
      return await VectorStoreService.getRelevantContext(userId, databaseId, question, 5);
    } catch (error) {
      console.error('Error getting historical context:', error);
      return 'No historical context available.';
    }
  }

  /**
   * Clear vector store for a user
   */
  static async clearUserVectorStore(userId: string, databaseId: string): Promise<void> {
    try {
      await VectorStoreService.clearVectorStore(userId, databaseId);
    } catch (error) {
      console.error('Error clearing vector store:', error);
      throw new Error('Failed to clear vector store');
    }
  }
} 