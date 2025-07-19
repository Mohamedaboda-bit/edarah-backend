// RAG Flow:
// 1. User sends a question to /api/rag/analyze
// 2. Backend retrieves the database schema for the user
// 3. Prompt 1: Formats a prompt for SQL generation (using schema and question), sends it to OpenAI GPT-4o to generate a SQL query
// 4. Strips code block markers and explanation from the LLM output, executes the SQL query on the user's database
// 5. Embeds the results and stores them in a vector store (using OpenAI text-embedding-3-small)
// 6. Retrieves relevant context from the vector store for the question
// 7. Prompt 2: Formats a prompt for business analysis (using question, query results, and context), sends it to OpenAI GPT-4.1-mini to generate insights
// 8. Returns the SQL, insights, and recommendations to the user

import { PROMPT_TEMPLATES, openAIQueryLLM, openAIAnalysisLLM, executeSQLGeneration, executeBusinessAnalysis, executeSchemaAnalysis, executeQuestionClassification, executeGeneralKnowledge } from '../configs/langchain';
import { DatabaseConnectionService, DatabaseSchema } from './databaseConnection';
import { VectorStoreService } from './vectorStore';
import { CacheService } from './cacheService';
import { prisma } from '../index';
// Update LangChain imports to latest API
import { BufferMemory } from 'langchain/memory';
import { semanticCache } from './semanticCache';
import { getEmbeddings } from '../configs/langchain';

export interface RAGRequest {
  question: string;
  userId: string;
  databaseId?: string;
  context?: string;
  useGeneralKnowledge?: boolean; // true: force general knowledge, false: force database, undefined: auto-classify
}

export interface RAGResponse {
  insights: string;
  recommendations: string[];
  dataSummary: {
    totalRecords: number;
    keyMetrics: Record<string, any>;
  };
  query?: string; // Renamed from sqlQuery to query for clarity
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

// Memory manager using LangChain ConversationBufferMemory
const userMemories: Map<string, BufferMemory> = new Map();

function getUserMemory(userId: string): BufferMemory {
  if (!userMemories.has(userId)) {
    userMemories.set(userId, new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history',
      inputKey: 'question',
      outputKey: 'response',
      // maxMessages is not a valid option for BufferMemory, so remove it
    }));
  }
  return userMemories.get(userId)!;
}

function clearUserMemory(userId: string) {
  userMemories.delete(userId);
}

/**
 * Load conversation history from user memory
 */
async function loadConversationHistory(userId: string): Promise<string> {
  try {
    const memory = getUserMemory(userId);
    const memoryVariables = await memory.loadMemoryVariables({});
    const chatHistory = memoryVariables.chat_history;
    
    if (!chatHistory || chatHistory.length === 0) {
      return '';
    }
    
    // Format conversation history for prompt inclusion
    const formattedHistory = chatHistory
      .map((message: any, index: number) => {
        const role = message._getType() === 'human' ? 'User' : 'Assistant';
        const content = message.content;
        return `${role}: ${content}`;
      })
      .join('\n');
    
    return formattedHistory;
  } catch (error) {
    console.error('Error loading conversation history:', error);
    return '';
  }
}

/**
 * Save conversation to user memory
 */
async function saveConversation(userId: string, question: string, response: string): Promise<void> {
  try {
    const memory = getUserMemory(userId);
    await memory.saveContext(
      { question },
      { response }
    );
    console.log(`Conversation saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

export { getUserMemory, clearUserMemory, userMemories, loadConversationHistory, saveConversation };

/**
 * Question classification interface
 */
interface QuestionClassification {
  needsDatabase: boolean;
  reason: string;
  confidence: number;
}

/**
 * Classify whether a question needs database analysis or can be answered from general knowledge
 */
async function classifyQuestion(question: string, chatHistory: string): Promise<QuestionClassification> {
  try {
    console.log('Classifying question:', question);
    
    const result = await executeQuestionClassification({
      question,
      chatHistory
    });
    
    console.log('Raw classification result:', result);
    
    // Parse the JSON response
    let classification: { needsDatabase: string; reason: string; confidence: number };
    try {
      classification = JSON.parse(result);
    } catch (parseError) {
      console.error('Failed to parse classification JSON, defaulting to database:', parseError);
      // Default to database for safety
      return {
        needsDatabase: true,
        reason: 'Failed to parse classification, defaulting to database for safety',
        confidence: 5
      };
    }
    
    console.log('Question classification (raw):', classification);
    let needsDatabase: boolean;
    if (typeof classification.needsDatabase === 'string') {
      const val = classification.needsDatabase.trim().toLowerCase();
      if (val === 'yes') needsDatabase = true;
      else if (val === 'no') needsDatabase = false;
      else if (val === 'maybe') needsDatabase = true; // default to database for safety
      else needsDatabase = true; // fallback
    } else if (typeof classification.needsDatabase === 'boolean') {
      needsDatabase = classification.needsDatabase;
    } else {
      needsDatabase = true;
    }
    
    if (typeof classification.confidence !== 'number' || classification.confidence < 1 || classification.confidence > 10) {
      classification.confidence = 5;
    }
    
    // If confidence is low, default to database for safety
    if (classification.confidence < 6) {
      console.log('Low confidence classification, defaulting to database for safety');
      needsDatabase = true;
      classification.reason = 'Low confidence classification, defaulting to database for safety';
    }
    
    return {
      needsDatabase,
      reason: classification.reason,
      confidence: classification.confidence
    };
  } catch (error) {
    console.error('Error classifying question, defaulting to database:', error);
    return {
      needsDatabase: true,
      reason: 'Classification failed, defaulting to database for safety',
      confidence: 5
    };
  }
}

export class RAGService {
  /**
   * Process general knowledge request (no database needed)
   */
  private static async processGeneralRequest(request: RAGRequest, chatHistory: string): Promise<RAGResponse> {
    try {
      console.log('Processing general knowledge request for question:', request.question);
      
      const response = await executeGeneralKnowledge({
        question: request.question,
        chatHistory: chatHistory
      });
      
      console.log('General knowledge response:', response);
      
      // Save conversation to memory
      await saveConversation(request.userId, request.question, response);
      console.log('General knowledge conversation saved successfully');
      
      // Return simplified response format
      return {
        insights: response,
        recommendations: [],
        dataSummary: {
          totalRecords: 0,
          keyMetrics: {}
        },
        confidence: 8,
        databaseInfo: {
          name: 'General Knowledge',
          type: 'conversation_history'
        }
      };
    } catch (error) {
      console.error('Error processing general knowledge request:', error);
      throw new Error('Failed to process general knowledge request');
    }
  }

  /**
   * Process database request (existing RAG flow)
   */
  private static async processDatabaseRequest(request: RAGRequest, chatHistory: string): Promise<RAGResponse> {
    try {
      console.log('Processing database request for question:', request.question);

      // Step 1: Get user's database information
      const databaseInfo = await this.getUserDatabase(request.userId, request.databaseId);
      // Step 2: Get or refresh schema
      const schema = await this.getSchema(databaseInfo);

      // Step 3: SQL generation prompt with MySQL and status instructions
      const schemaDescription = this.formatSchemaForPrompt(schema);
      let dbInstructions = '';
      if (schema.databaseType === 'mysql') {
        dbInstructions = `\n- Use only MySQL 8.0 compatible syntax.\n- Do not use multiple CTEs (WITH ... AS ...), use subqueries if needed.\n- Do not include explanations or comments, only the SQL statement.\n- ONLY generate SELECT queries, NEVER INSERT, UPDATE, or DELETE operations.\n- Do not use double quotes for table or column names. Use backticks or no quotes.\n- For order status, use actual values from the database: 'delivered', 'shipped', 'processing', etc. Do NOT use 'Completed'. If unsure, use IN ('delivered', 'shipped', 'processing').`;
      }
      const prompt = PROMPT_TEMPLATES.formatSQLPrompt({
        schema: schemaDescription,
        question: request.question,
        databaseType: schema.databaseType,
        chatHistory: chatHistory
      }) + dbInstructions;
      console.log('Prompt to OpenAI (SQL generation):\n', prompt);
      let sqlResult = await openAIQueryLLM.call({ prompt });
      let sqlQuery = sqlResult.text.trim().replace(/```sql|```javascript|```/gi, '').trim();
      // Only allow SELECT queries for SQL databases
      const sqlMatch = sqlQuery.match(/SELECT[\s\S]*/i);
      if (sqlMatch) {
        sqlQuery = sqlMatch[0].trim();
      } else {
        throw new Error('Only SELECT queries are allowed for data analysis. No INSERT, UPDATE, or DELETE operations permitted.');
      }
      // Post-process query for MySQL compatibility
      if (schema.databaseType === 'mysql') {
        sqlQuery = sqlQuery.replace(/"/g, '`'); // Replace double quotes with backticks
      }
      console.log('Final query to execute:', sqlQuery);
      // Step 4: Execute query, with fallback if it fails
      let queryResult: any[] = [];
      let mainQueryResult;
      try {
        mainQueryResult = await this.executeQuery(databaseInfo, sqlQuery);
        console.log('Main SQL query result:', mainQueryResult);
        // If query returns no results, try a less restrictive fallback query
        if (mainQueryResult.length === 0) {
          console.log('Query returned no results, trying less restrictive fallback query...');
          // Remove status filter if present
          let fallbackQuery = sqlQuery.replace(/WHERE\s+o\.status\s*=\s*['\"]\w+['\"]/i, '');
          // Or use IN ('delivered', 'shipped', 'processing')
          if (fallbackQuery === sqlQuery) {
            fallbackQuery = sqlQuery.replace(/WHERE\s+o\.status\s*=\s*['\"]\w+['\"]/i, "WHERE o.status IN ('delivered','shipped','processing')");
          }
          if (fallbackQuery === sqlQuery) {
            // If no status filter, just remove WHERE clause
            fallbackQuery = sqlQuery.replace(/WHERE[\s\S]*?(GROUP BY|ORDER BY|LIMIT)/i, '$1');
          }
          console.log('Fallback query:', fallbackQuery);
          let fallbackResult = [];
          try {
            fallbackResult = await this.executeQuery(databaseInfo, fallbackQuery);
            console.log('Fallback SQL query result:', fallbackResult);
          } catch (fallbackError) {
            console.log('Fallback query failed:', fallbackError);
          }
          // Use fallback only if it returns data
          queryResult = fallbackResult.length > 0 ? fallbackResult : mainQueryResult;
        } else {
          queryResult = mainQueryResult;
        }
      } catch (error) {
        // If SQL execution fails, re-prompt LLM with error and ask for a fix
        const errorMsg = error instanceof Error ? error.message : String(error);
        const fixPrompt = `${prompt}\n\nThe previous query failed with the following error for ${schema.databaseType}:\n${errorMsg}\nPlease fix the query for this database and return only the corrected query.\n- Use only MySQL 8.0 compatible syntax.\n- Do not use multiple CTEs.\n- Do not use double quotes for table or column names.\n- Use IN ('delivered','shipped','processing') for order status if needed.`;
        console.log('Re-prompting OpenAI (query fix):\n', fixPrompt);
        sqlResult = await openAIQueryLLM.call({ prompt: fixPrompt });
        sqlQuery = sqlResult.text.trim().replace(/```sql|```javascript|```/gi, '').trim();
        // Only allow SELECT queries for SQL databases
        const sqlMatch2 = sqlQuery.match(/SELECT[\s\S]*/i);
        if (sqlMatch2) {
          sqlQuery = sqlMatch2[0].trim();
        } else {
          throw new Error('Only SELECT queries are allowed for data analysis. No INSERT, UPDATE, or DELETE operations permitted.');
        }
        if (schema.databaseType === 'mysql') {
          sqlQuery = sqlQuery.replace(/"/g, '`');
        }
        // Try executing the fixed query
        queryResult = await this.executeQuery(databaseInfo, sqlQuery);
      }
      // Step 5: Defensive: Ensure queryResult is always an array
      if (!Array.isArray(queryResult)) {
        if (queryResult === undefined || queryResult === null) {
          queryResult = [];
        } else {
          queryResult = [queryResult];
        }
      }
      console.log('SQL Results before formatting:', queryResult, 'Length:', queryResult.length);
      // If after all attempts there is still no data, return a clear message to the user
      if (queryResult.length === 0) {
        return {
          insights: 'No data found for your request. Please check your filters or ensure your database contains relevant data.',
          recommendations: [],
          dataSummary: { totalRecords: 0, keyMetrics: {} },
          confidence: 2,
          query: sqlQuery,
          databaseInfo: { name: databaseInfo.name, type: databaseInfo.type }
        };
      }
      // Step 6: Process results and add to vector store
      // Defensive: Ensure queryResult is always an array
      if (!Array.isArray(queryResult)) {
        if (queryResult === undefined || queryResult === null) {
          queryResult = [];
        } else {
          queryResult = [queryResult];
        }
      }
      const documents = await VectorStoreService.processQueryResults(
        request.userId,
        databaseInfo.id,
        queryResult,
        request.question,
        sqlQuery
      );
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
      // Step 7: Get relevant context from vector store
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
      // Step 8: Generate insights using manual prompt formatting and LLM call
      // Defensive: Ensure queryResult is always an array before formatting
      console.log('SQL Results before formatting:', queryResult, 'Length:', queryResult.length);
      let safeQueryResult = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
      console.log('Safe SQL Results before formatting:', safeQueryResult, 'Length:', safeQueryResult.length);
      const dataContext = this.formatDataForPrompt(safeQueryResult);
      console.log('=== DATA FLOW DEBUG ===');
      console.log('Query result length:', queryResult.length);
      console.log('Query result type:', typeof queryResult);
      console.log('Query result is array:', Array.isArray(queryResult));
      console.log('First few query results:', queryResult.slice(0, 3));
      console.log('Data context being sent to second model:', dataContext);
      console.log('Data context length:', dataContext.length);
      console.log('=== END DATA FLOW DEBUG ===');
      const combinedContext = [request.context, relevantContext].filter(Boolean).join('\n\n');
      const businessPrompt = PROMPT_TEMPLATES.formatBusinessAnalysisPrompt({
        question: request.question,
        data: dataContext,
        context: combinedContext || 'No additional context provided',
        chatHistory: chatHistory
      });
      console.log('Prompt to OpenAI GPT-4.1-nano (Business analysis):\n', businessPrompt);
      const insightsResult = await openAIAnalysisLLM.call({ prompt: businessPrompt });
      console.log('Raw insights response:', insightsResult.text);
      let insights: any = {};
      try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedText = insightsResult.text || '{}';
        cleanedText = cleanedText.replace(/```json\s*|\s*```/gi, '').trim();
        insights = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse insights JSON:', parseError);
        console.error('Raw text was:', insightsResult.text);
        // Fallback: create a clean response without database details
        insights = {
          insights: insightsResult.text ? insightsResult.text.replace(/```json\s*|\s*```/gi, '').trim() : 'Analysis completed successfully',
          recommendations: ['Review the analysis for specific recommendations'],
          dataSummary: { totalRecords: queryResult.length, keyMetrics: {} },
          confidence: 5,
        };
      }
      // Step 9: Save conversation to memory
      const responseText = JSON.stringify({
        insights: insights.insights,
        recommendations: insights.recommendations,
        dataSummary: insights.dataSummary,
        confidence: insights.confidence,
        query: sqlQuery
      });
      console.log('Saving conversation to memory for user:', request.userId);
      await saveConversation(request.userId, request.question, responseText);
      console.log('Conversation saved successfully');
      // Step 10: Return complete response
      return {
        ...insights,
        query: sqlQuery,
        databaseInfo: {
          name: databaseInfo.name,
          type: databaseInfo.type
        }
      };
    } catch (error) {
      console.error('Error processing database request:', error);
      throw error;
    }
  }

  /**
   * Process RAG request with smart question classification
   */
  static async processRequest(request: RAGRequest): Promise<RAGResponse> {
    try {
      // Step 1: Load conversation history from user's memory
      const chatHistory = await loadConversationHistory(request.userId);
      console.log('Loaded conversation history:', chatHistory ? 'Available' : 'None');
      if (chatHistory) {
        console.log('Conversation history preview:', chatHistory.substring(0, 200) + '...');
      }

      // Step 2: Route based on user preference or automatic classification
      if (request.useGeneralKnowledge === true) {
        console.log('User preference: Using general knowledge pipeline');
        return await this.processGeneralRequest(request, chatHistory);
      } else if (request.useGeneralKnowledge === false) {
        console.log('User preference: Using database pipeline');
        return await this.processDatabaseRequest(request, chatHistory);
      } else {
        // Automatic classification when user doesn't specify preference
        console.log('No user preference: Using automatic classification');
        const classification = await classifyQuestion(request.question, chatHistory);
        console.log('Question classification result:', classification);
        
        if (classification.needsDatabase) {
          console.log('Routing to database processing path');
          return await this.processDatabaseRequest(request, chatHistory);
        } else {
          console.log('Routing to general knowledge processing path');
          return await this.processGeneralRequest(request, chatHistory);
        }
      }
    } catch (error) {
      console.error('Error in processRequest:', error);
      throw error;
    }
  }

  public static async getUserDatabase(userId: string, databaseId?: string): Promise<DatabaseInfo> {
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

  public static async getSchema(databaseInfo: DatabaseInfo): Promise<DatabaseSchema> {
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
      console.log('Executing query:', sqlQuery);
      console.log('Database info:', { type: databaseInfo.type, name: databaseInfo.name });
      
      const result = await DatabaseConnectionService.executeQuery(
        databaseInfo.connectionString,
        databaseInfo.type,
        sqlQuery
      );
      
      console.log('Query execution successful. Result count:', result.length);
      console.log('Result type:', typeof result);
      console.log('Result is array:', Array.isArray(result));
      console.log('First few results:', result.slice(0, 3));
      console.log('Result structure:', result.length > 0 ? Object.keys(result[0]) : 'No results');
      
      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
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
  ): Promise<Omit<RAGResponse, 'query' | 'databaseInfo'>> {
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

  public static formatSchemaForPrompt(schema: DatabaseSchema): string {
    return schema.tables.map(table => {
      const columns = table.columns.map(col => {
        let typeDescription = col.type;
        
        // For PostgreSQL, provide better type descriptions
        if (schema.databaseType === 'postgresql') {
          if (col.type === 'USER-DEFINED') {
            // Temporarily mark enum columns as problematic to avoid them in queries
            typeDescription = 'ENUM (avoid using this column in WHERE clauses for now)';
          } else if (col.type.includes('timestamp')) {
            typeDescription = 'TIMESTAMP';
          } else if (col.type === 'bigint') {
            typeDescription = 'BIGINT';
          }
        }
        
        return `${col.name} (${typeDescription})${col.isPrimaryKey ? ' [PRIMARY KEY]' : ''}${col.isNullable ? '' : ' [NOT NULL]'}`;
      }).join(', ');
      
      // For PostgreSQL, quote table names that contain uppercase letters
      const tableName = schema.databaseType === 'postgresql' && /[A-Z]/.test(table.name) 
        ? `"${table.name}"` 
        : table.name;
      
      return `Table: ${tableName}\nColumns: ${columns}`;
    }).join('\n\n');
  }

  /**
   * Format data for AI prompt
   */
  private static formatDataForPrompt(data: any[]): string {
    console.log('=== formatDataForPrompt DEBUG ===');
    console.log('Input data:', data);
    console.log('Input data type:', typeof data);
    console.log('Input data is array:', Array.isArray(data));
    console.log('Input data length:', data?.length);
    
    if (!data || data.length === 0) {
      console.log('No data found, returning default message');
      return 'No data found for the query.';
    }

    // Convert each row to a readable text format
    const formattedRows = data.map((row, index) => {
      console.log(`Processing row ${index}:`, row);
      const rowText = Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      return `Record ${index + 1}: ${rowText}`;
    });

    const result = formattedRows.join('\n\n') + `\n\nSummary: Found ${data.length} records`;
    console.log('Formatted result:', result);
    console.log('=== END formatDataForPrompt DEBUG ===');
    return result;
  }

  /**
   * Fix PostgreSQL table names to be properly quoted for case sensitivity
   */
  private static fixPostgreSQLTableNames(query: string, schema: DatabaseSchema): string {
    let fixedQuery = query;
    
    // Get all table names that contain uppercase letters
    const caseSensitiveTables = schema.tables
      .filter(table => /[A-Z]/.test(table.name))
      .map(table => table.name);
    
    // Replace unquoted table names with quoted ones
    caseSensitiveTables.forEach(tableName => {
      // Create regex patterns to match the table name in different contexts
      const patterns = [
        new RegExp(`\\bFROM\\s+${tableName}\\b`, 'gi'),
        new RegExp(`\\bJOIN\\s+${tableName}\\b`, 'gi'),
        new RegExp(`\\bUPDATE\\s+${tableName}\\b`, 'gi'),
        new RegExp(`\\bINSERT\\s+INTO\\s+${tableName}\\b`, 'gi'),
        new RegExp(`\\bDELETE\\s+FROM\\s+${tableName}\\b`, 'gi'),
        new RegExp(`\\bTABLE\\s+${tableName}\\b`, 'gi')
      ];
      
      patterns.forEach(pattern => {
        fixedQuery = fixedQuery.replace(pattern, (match) => {
          // Replace the table name part with quoted version
          return match.replace(tableName, `"${tableName}"`);
        });
      });
    });
    
    return fixedQuery;
  }

  /**
   * Fix PostgreSQL enum comparisons to use proper casting
   */
  private static fixPostgreSQLEnumComparisons(query: string, schema: DatabaseSchema): string {
    let fixedQuery = query;
    
    // Find columns that are USER-DEFINED (enums)
    const enumColumns = schema.tables.flatMap(table => 
      table.columns
        .filter(col => col.type === 'USER-DEFINED')
        .map(col => ({ 
          table: table.name, 
          column: col.name, 
          enumValues: col.enumValues || []
        }))
    );
    
    console.log('Found enum columns:', enumColumns.map(e => ({ column: e.column, values: e.enumValues })));
    
          // Common enum values for freelancing platforms (fallback when database enum values are not available)
      // Note: These are generic values - actual database values may differ
      const commonEnumValues = {
        status: ['pending', 'assigned', 'completed', 'cancelled', 'active', 'inactive'],
        rating_by_client: ['excellent', 'good', 'fair', 'poor'],
        role: ['client', 'freelancer', 'admin', 'moderator'],
        type: ['project', 'payment', 'notification', 'transaction'],
        method: ['credit_card', 'bank_transfer', 'paypal', 'wallet'],
        experience_needed: ['beginner', 'intermediate', 'expert'],
        budget_type: ['fixed', 'hourly', 'negotiable'],
        number_of_phases: ['single', 'multiple'],
        phase_number: ['phase_1', 'phase_2', 'phase_3'],
        provider: ['stripe', 'paypal', 'bank'],
        verification_status: ['pending', 'verified', 'rejected'],
        direction: ['in', 'out']
      };
    
    // Fix enum comparisons by ensuring values are properly quoted and valid
    enumColumns.forEach(({ table, column, enumValues }) => {
      // Use fallback enum values if database enum values are not available
      const availableEnumValues = enumValues.length > 0 ? enumValues : (commonEnumValues[column] || []);
      
      // Pattern to match enum column comparisons without proper quoting
      const patterns = [
        // Match: column = value (without quotes)
        new RegExp(`\\b${column}\\s*=\\s*([a-zA-Z_][a-zA-Z0-9_]*)`, 'gi'),
        // Match: column IN (value1, value2) (without quotes)
        new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]+)\\)`, 'gi')
      ];
      
      patterns.forEach(pattern => {
        fixedQuery = fixedQuery.replace(pattern, (match, values) => {
          if (pattern.source.includes('IN')) {
            // Handle IN clause
            const valueList = values.split(',').map(v => v.trim());
            const quotedValues = valueList.map(v => `'${v}'`).join(', ');
            return match.replace(values, quotedValues);
          } else {
            // Handle simple equality - check if value is valid
            const value = values.trim();
            if (availableEnumValues.length > 0 && !availableEnumValues.includes(value)) {
              console.warn(`Invalid enum value '${value}' for column '${column}'. Valid values: ${availableEnumValues.join(', ')}`);
              // Use the first valid enum value as fallback
              return match.replace(values, `'${availableEnumValues[0]}'`);
            } else if (availableEnumValues.length === 0) {
              // If we don't have enum values, remove the condition entirely to avoid errors
              console.warn(`No enum values found for column '${column}', removing condition to avoid errors`);
              return match.replace(new RegExp(`\\b${column}\\s*=\\s*'${value}'\\s*(AND|OR|$|\\s)`, 'gi'), '$1');
            }
            return match.replace(values, `'${value}'`);
          }
        });
      });
    });
    
    return fixedQuery;
  }

  /**
   * Basic SQL syntax validation and fixing
   */
  private static validateAndFixSQLSyntax(query: string): string {
    let fixedQuery = query;
    
    // Remove any trailing semicolons that might cause issues
    fixedQuery = fixedQuery.replace(/;\s*$/, '');
    
    // Fix common syntax issues
    fixedQuery = fixedQuery
      // Remove any double spaces
      .replace(/\s+/g, ' ')
      // Fix common alias issues
      .replace(/\bFROM\s+(\w+)\s+(\w+)\s+(\w+)\s+(\w+)/gi, 'FROM $1 $2 $3 $4')
      // Ensure proper spacing around operators
      .replace(/(\w+)([=<>!]+)(\w+)/g, '$1 $2 $3')
      // Fix common JOIN syntax issues
      .replace(/\bJOIN\s+(\w+)\s+(\w+)\s+ON\s+(\w+)\s*=\s*(\w+)/gi, 'JOIN $1 $2 ON $3 = $4');
    
    // Basic validation - check for obvious syntax errors
    const commonErrors = [
      /,\s*,/, // Double commas
      /\(\s*\)/, // Empty parentheses
      /SELECT\s+$/i, // SELECT without columns
      /FROM\s+$/i, // FROM without table
    ];
    
    for (const errorPattern of commonErrors) {
      if (errorPattern.test(fixedQuery)) {
        console.warn('Potential SQL syntax issue detected:', errorPattern.source);
      }
    }
    
    return fixedQuery.trim();
  }

  /**
   * Remove WHERE conditions that might filter out all data
   */
  private static removeProblematicWhereConditions(query: string): string {
    let fixedQuery = query;
    
    // Remove WHERE conditions that might be too restrictive
    const problematicConditions = [
      /WHERE\s+fp\.available\s*=\s*true/gi,
      /WHERE\s+available\s*=\s*true/gi,
      /WHERE\s+status\s*=\s*'[^']*'/gi,
      /WHERE\s+[a-zA-Z_]+\s*=\s*'[^']*'/gi
    ];
    
    problematicConditions.forEach(pattern => {
      if (pattern.test(fixedQuery)) {
        console.warn('Removing potentially problematic WHERE condition:', pattern.source);
        fixedQuery = fixedQuery.replace(pattern, '');
      }
    });
    
    // Clean up any trailing AND/OR operators
    fixedQuery = fixedQuery
      .replace(/\s+AND\s*$/gi, '')
      .replace(/\s+OR\s*$/gi, '')
      .replace(/WHERE\s*$/gi, '');
    
    return fixedQuery;
  }

  /**
   * Generate schema version for caching
   */
  private static generateSchemaVersion(schema: DatabaseSchema): string {
    const schemaString = JSON.stringify(schema, Object.keys(schema).sort());
    return require('crypto').createHash('sha256').update(schemaString).digest('hex').substring(0, 8);
  }

  /**
   * Generate a simple fallback query when complex queries return no results
   */
  private static generateSimpleFallbackQuery(schema: DatabaseSchema, question: string): string {
    // Find tables with financial/revenue data
    const financialTables = schema.tables.filter(table => 
      table.columns.some(col => 
        col.name.toLowerCase().includes('earned') || 
        col.name.toLowerCase().includes('amount') || 
        col.name.toLowerCase().includes('revenue') || 
        col.name.toLowerCase().includes('budget') ||
        col.name.toLowerCase().includes('payment')
      )
    );
    
    if (financialTables.length > 0) {
      const table = financialTables[0];
      const financialColumns = table.columns.filter(col => 
        col.type === 'integer' || col.type === 'numeric' || col.type === 'bigint'
      );
      
      if (financialColumns.length > 0) {
        const column = financialColumns[0];
        return `SELECT ${column.name}, COUNT(*) as count FROM "${table.name}" GROUP BY ${column.name} ORDER BY ${column.name} DESC LIMIT 10`;
      }
    }
    
    // Fallback to any table with data
    const anyTable = schema.tables.find(table => 
      table.columns.some(col => col.type === 'integer' || col.type === 'numeric' || col.type === 'bigint')
    );
    
    if (anyTable) {
      const numericColumn = anyTable.columns.find(col => 
        col.type === 'integer' || col.type === 'numeric' || col.type === 'bigint'
      );
      
      if (numericColumn) {
        return `SELECT ${numericColumn.name}, COUNT(*) as count FROM "${anyTable.name}" GROUP BY ${numericColumn.name} ORDER BY ${numericColumn.name} DESC LIMIT 10`;
      }
    }
    
    // Last resort: just get some data from any table
    const firstTable = schema.tables[0];
    return `SELECT * FROM "${firstTable.name}" LIMIT 10`;
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

  /**
   * Extract table names from a SQL query (supports FROM, JOIN, UPDATE, INTO)
   */
  public static extractTableNamesFromSQL(sqlQuery: string): string[] {
    if (!sqlQuery) return [];
    const tableNames = new Set<string>();
    // Match FROM, JOIN, UPDATE, INTO (ignore subqueries and aliases)
    const regex = /\b(?:FROM|JOIN|UPDATE|INTO)\s+([`'"]?\w+[`'"]?)/gi;
    let match;
    while ((match = regex.exec(sqlQuery)) !== null) {
      let table = match[1];
      // Remove quotes/backticks
      table = table.replace(/^[`'"]|[`'"]$/g, '');
      tableNames.add(table);
    }
    return Array.from(tableNames);
  }
} 