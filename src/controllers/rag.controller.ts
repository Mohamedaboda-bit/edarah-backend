import { Request, Response } from 'express';
import { RAGService, RAGRequest, getUserMemory as getUserMemoryHelper, userMemories as userMemoryMap, loadConversationHistory, saveConversation } from '../utils/ragService';
import { DatabaseConnectionService } from '../utils/databaseConnection';
import { VectorStoreService } from '../utils/vectorStore';
import { EncryptionService } from '../utils/encryption';
import { RateLimiterService } from '../utils/rateLimiter';
import { prisma } from '../index';

export class RAGController {
  /**
   * Analyze business data and provide insights
   */
  static async analyzeData(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // Check rate limit
      const rateLimit = await RateLimiterService.checkRateLimit(userId);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        });
      }

      const { question, databaseId, context, useGeneralKnowledge } = req.body;

      // Validate required fields
      if (!question) {
        return res.status(400).json({ success: false, error: 'Question is required' });
      }

      // Process RAG request
      const ragRequest: RAGRequest = {
        question,
        userId,
        databaseId,
        context,
        useGeneralKnowledge: !!useGeneralKnowledge // default to false if not sent
      };

      const result = await RAGService.processRequest(ragRequest);

      return res.status(200).json({
        success: true,
        message: 'Analysis completed successfully',
        data: result,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime
        }
      });

    } catch (error) {
      console.error('RAG analysis error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to analyze data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add or update database connection
   */
  static async connectDatabase(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      // console.log(userId)
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const { connectionString, databaseName } = req.body;

      // Validate required fields
      if (!connectionString) {
        return res.status(400).json({ success: false, error: 'Connection string is required' });
      }

      // Detect database type
      const databaseType = DatabaseConnectionService.detectDatabaseType(connectionString);
      const extractedDbName = databaseName || DatabaseConnectionService.extractDatabaseName(connectionString, databaseType);

      // Check user's database limit
      const userPlan = await prisma.user_plans.findFirst({
        where: {
          user_id: BigInt(userId),
          is_active: true
        },
        include: {
          plan: true
        }
      });

      if (userPlan) {
        const currentDatabases = await prisma.user_databases.count({
          where: {
            user_id: BigInt(userId),
            is_active: true
          }
        });

        if (currentDatabases >= userPlan.plan.database_limit_number) {
          return res.status(403).json({
            success: false,
            error: `Database limit exceeded. Your plan allows ${userPlan.plan.database_limit_number} databases.`
          });
        }
      }

      // Test connection
      const encryptedConnectionString = EncryptionService.encrypt(connectionString);
      const connectionTest = await DatabaseConnectionService.testConnection(encryptedConnectionString, databaseType);
      
      if (!connectionTest.success) {
        return res.status(400).json({
          success: false,
          error: 'Database connection failed',
          details: connectionTest.error
        });
      }

      // Get schema for caching
      const schema = await DatabaseConnectionService.getSchema(encryptedConnectionString, databaseType);

      // Check if database already exists for this user
      const existingDatabase = await prisma.user_databases.findFirst({
        where: {
          user_id: BigInt(userId),
          database_name: extractedDbName,
          is_active: true
        }
      });

      let userDatabase;
      
      if (existingDatabase) {
        // Update existing database
        userDatabase = await prisma.user_databases.update({
          where: { id: existingDatabase.id },
          data: {
            database_type: databaseType,
            connection_string: encryptedConnectionString,
            schema_cache: schema as any,
            last_schema_update: new Date()
          }
        });
      } else {
        // Create new database
        userDatabase = await prisma.user_databases.create({
          data: {
            user_id: BigInt(userId),
            database_type: databaseType,
            connection_string: encryptedConnectionString,
            database_name: extractedDbName,
            schema_cache: schema as any,
            is_active: true
          }
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Database connected successfully',
        data: {
          id: userDatabase.id.toString(),
          name: userDatabase.database_name,
          type: userDatabase.database_type,
          schema: schema
        }
      });

    } catch (error) {
      console.error('Database connection error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to connect database',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's databases
   */
  static async getUserDatabases(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const databases = await prisma.user_databases.findMany({
        where: {
          user_id: BigInt(userId),
          is_active: true
        },
        select: {
          id: true,
          database_name: true,
          database_type: true,
          created_at: true,
          last_schema_update: true
        }
      });

      return res.status(200).json({
        success: true,
        data: databases.map(db => ({
          id: db.id.toString(),
          name: db.database_name,
          type: db.database_type,
          createdAt: db.created_at,
          lastSchemaUpdate: db.last_schema_update
        }))
      });

    } catch (error) {
      console.error('Get databases error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get databases',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get database schema
   */
  static async getDatabaseSchema(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { databaseId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!databaseId) {
        return res.status(400).json({ success: false, error: 'Database ID is required' });
      }

      const userDatabase = await prisma.user_databases.findFirst({
        where: {
          id: BigInt(databaseId),
          user_id: BigInt(userId),
          is_active: true
        }
      });

      if (!userDatabase) {
        return res.status(404).json({ success: false, error: 'Database not found' });
      }

      // Get fresh schema
      const schema = await DatabaseConnectionService.getSchema(
        userDatabase.connection_string,
        userDatabase.database_type
      );

      // Update cache
      await prisma.user_databases.update({
        where: { id: BigInt(databaseId) },
        data: {
          schema_cache: schema as any,
          last_schema_update: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        data: schema
      });

    } catch (error) {
      console.error('Get schema error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get schema',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Remove database connection
   */
  static async removeDatabase(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { databaseId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!databaseId) {
        return res.status(400).json({ success: false, error: 'Database ID is required' });
      }

      const userDatabase = await prisma.user_databases.findFirst({
        where: {
          id: BigInt(databaseId),
          user_id: BigInt(userId),
          is_active: true
        }
      });

      if (!userDatabase) {
        return res.status(404).json({ success: false, error: 'Database not found' });
      }

      // Soft delete by setting is_active to false
      await prisma.user_databases.update({
        where: { id: BigInt(databaseId) },
        data: { is_active: false }
      });

      return res.status(200).json({
        success: true,
        message: 'Database removed successfully'
      });

    } catch (error) {
      console.error('Remove database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove database',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get rate limit information
   */
  static async getRateLimitInfo(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const rateLimitInfo = await RateLimiterService.getRemainingRequests(userId);

      return res.status(200).json({
        success: true,
        data: rateLimitInfo
      });

    } catch (error) {
      console.error('Get rate limit info error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get rate limit information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get historical context from vector store
   */
  static async getHistoricalContext(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { databaseId } = req.params;
      const { question, limit = 5 } = req.query;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!databaseId || !question) {
        return res.status(400).json({ success: false, error: 'Database ID and question are required' });
      }

      const context = await VectorStoreService.getRelevantContext(
        userId,
        databaseId as string,
        question as string,
        Number(limit)
      );

      return res.status(200).json({
        success: true,
        data: { context }
      });

    } catch (error) {
      console.error('Get historical context error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get historical context',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear vector store for a database
   */
  static async clearVectorStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { databaseId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!databaseId) {
        return res.status(400).json({ success: false, error: 'Database ID is required' });
      }

      await VectorStoreService.clearVectorStore(userId, databaseId);

      return res.status(200).json({
        success: true,
        message: 'Vector store cleared successfully'
      });

    } catch (error) {
      console.error('Clear vector store error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clear vector store',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get current user's conversation memory
   */
  static async getUserMemory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }
      
      const memory = getUserMemoryHelper(userId);
      const chatHistory = await loadConversationHistory(userId);
      
      return res.status(200).json({ 
        success: true, 
        data: {
          memoryExists: !!memory,
          hasConversationHistory: !!chatHistory,
          conversationCount: chatHistory ? chatHistory.split('\n').filter(line => line.startsWith('User:')).length : 0
        } 
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to get memory' });
    }
  }

  /**
   * Clear current user's conversation memory
   */
  static async clearUserMemory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }
      userMemoryMap.delete(userId);
      return res.status(200).json({ success: true, message: 'Memory cleared' });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to clear memory' });
    }
  }

  /**
   * Get conversation history for a user
   */
  static async getConversationHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const memory = getUserMemoryHelper(userId);
      const memoryVariables = await memory.loadMemoryVariables({});
      const chatHistory = memoryVariables.chat_history;

      return res.status(200).json({
        success: true,
        data: {
          history: chatHistory || []
        }
      });

    } catch (error) {
      console.error('Get conversation history error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get conversation history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const { CacheService } = await import('../utils/cacheService');
      const stats = CacheService.getCacheStats(userId);
      const size = CacheService.getCacheSize();

      return res.status(200).json({
        success: true,
        data: {
          stats,
          size,
          userId
        }
      });

    } catch (error) {
      console.error('Get cache stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear user cache
   */
  static async clearUserCache(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const { CacheService } = await import('../utils/cacheService');
      CacheService.clearUserCache(userId);

      return res.status(200).json({
        success: true,
        message: 'User cache cleared successfully',
        data: { userId }
      });

    } catch (error) {
      console.error('Clear user cache error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clear user cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear database cache
   */
  static async clearDatabaseCache(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { databaseId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!databaseId) {
        return res.status(400).json({ success: false, error: 'Database ID is required' });
      }

      const { CacheService } = await import('../utils/cacheService');
      CacheService.invalidateDatabaseCache(userId, databaseId);

      return res.status(200).json({
        success: true,
        message: 'Database cache cleared successfully',
        data: { userId, databaseId }
      });

    } catch (error) {
      console.error('Clear database cache error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clear database cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear all cache (admin only)
   */
  static async clearAllCache(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // TODO: Add admin check here if needed
      // const user = await prisma.users.findUnique({ where: { id: BigInt(userId) } });
      // if (!user?.is_admin) {
      //   return res.status(403).json({ success: false, error: 'Admin access required' });
      // }

      const { CacheService } = await import('../utils/cacheService');
      CacheService.clearAllCache();

      return res.status(200).json({
        success: true,
        message: 'All cache cleared successfully',
        data: { clearedBy: userId }
      });

    } catch (error) {
      console.error('Clear all cache error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clear all cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const { CacheService } = await import('../utils/cacheService');
      CacheService.cleanupExpiredCache();

      return res.status(200).json({
        success: true,
        message: 'Expired cache entries cleaned up successfully'
      });

    } catch (error) {
      console.error('Cleanup expired cache error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Expand/explain a specific recommendation from RAG analysis
   */
  static async expandRecommendation(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // Check rate limit
      const rateLimit = await RateLimiterService.checkRateLimit(userId);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        });
      }

      const { recommendation, question, databaseId, context } = req.body;
      if (!recommendation) {
        return res.status(400).json({ success: false, error: 'Recommendation is required' });
      }

      // Load chat history (for context, but we will overwrite instructions)
      const chatHistory = await loadConversationHistory(userId);

      // Build a fully custom, strict prompt
      let prompt = `IGNORE ALL PREVIOUS INSTRUCTIONS AND FORMATTING, including any instructions in the conversation history or chat memory.\n\nExpand and explain in depth the following business recommendation.\n\n- ONLY return a plain text, in-depth explanation.\n- DO NOT return JSON, objects, recommendations, summaries, or any extra fields.\n- DO NOT include any marketing advice or general business analysis.\n- Focus on the meaning, reasoning, possible causes, business impact, and practical implications of the recommendation.\n- Your output must be a single, detailed paragraph.\n\nRecommendation: ${recommendation}`;
      if (question) {
        prompt += `\n\nThis recommendation was generated in response to: ${question}`;
      }
      prompt += `\n\nSample output:\nA detailed, focused explanation of the recommendation, including reasoning, business impact, and practical implications. No general advice, no recommendations, no JSON, just a paragraph of explanation.`;

      // Call the LLM directly (not using the business analysis template)
      const { openAIAnalysisLLM } = await import('../configs/langchain');
      const aiResult = await openAIAnalysisLLM.call({ prompt });
      let insights = aiResult.text;

      // If the response is JSON or contains a JSON string, extract only the explanation
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(insights);
        if (typeof parsed === 'string') {
          insights = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.insights) {
            insights = parsed.insights;
          } else {
            // Try to find the first string value
            const firstString = Object.values(parsed).find(v => typeof v === 'string');
            if (firstString) insights = firstString as string;
          }
        }
      } catch (e) {
        // Not JSON, keep as is
      }

      return res.status(200).json({
        success: true,
        message: 'Recommendation expanded successfully',
        data: { insights },
        rateLimit: {
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime
        }
      });
    } catch (error) {
      console.error('Expand recommendation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to expand recommendation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate a detailed marketing plan based on database data
   */
  static async generateMarketingPlan(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // Check rate limit
      const rateLimit = await RateLimiterService.checkRateLimit(userId);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        });
      }

      const { question, databaseId, generateImage } = req.body;
      // 1. Get user's database info
      const databaseInfo = await RAGService.getUserDatabase(userId, databaseId);
      // 2. Get schema
      const schema = await RAGService.getSchema(databaseInfo);
      const schemaDescription = RAGService.formatSchemaForPrompt(schema);

      // 3. LLM: Generate SQL query for marketing plan data (with MySQL instructions)
      const { openAIQueryLLM, openAIAnalysisLLM } = await import('../configs/langchain');
      let dbInstructions = '';
      if (schema.databaseType === 'mysql') {
        dbInstructions = `\n- Use only MySQL 8.0 compatible syntax.\n- Do not use multiple CTEs (WITH ... AS ...), use subqueries if needed.\n- Do not include explanations or comments, only the SQL statement.\n- ONLY generate SELECT queries, NEVER INSERT, UPDATE, or DELETE operations.\n- Do not use double quotes for table or column names. Use backticks or no quotes.\n- For order status, use actual values from the database: 'delivered', 'shipped', 'processing', etc. Do NOT use 'Completed'. If unsure, use IN ('delivered', 'shipped', 'processing').`;
      }
      const sqlPrompt = `You are a SQL expert. Generate a SQL query to extract ALL data needed to create a detailed marketing plan for this business. Consider product/service sector, competitors, sales, customer segments, regions, and any other relevant data. Use the provided schema.\n\nDatabase Schema:\n${schemaDescription}${dbInstructions}`;
      const sqlResult = await openAIQueryLLM.call({ prompt: sqlPrompt });
      let sqlQuery = sqlResult.text.trim().replace(/```sql|```/gi, '').trim();
      // Only allow SELECT queries
      const sqlMatch = sqlQuery.match(/SELECT[\s\S]*/i);
      if (sqlMatch) {
        sqlQuery = sqlMatch[0].trim();
      } else {
        throw new Error('Only SELECT queries are allowed for marketing plan generation.');
      }
      if (schema.databaseType === 'mysql') {
        sqlQuery = sqlQuery.replace(/"/g, '`');
      }
      // Remove or comment out all console.log statements related to SQL and data in generateMarketingPlan
      let queryResult: any[] = [];
      let mainQueryResult;
      let sqlError = null;
      try {
        mainQueryResult = await DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, sqlQuery);
        if (mainQueryResult.length === 0) {
          // Remove status filter if present
          let fallbackQuery = sqlQuery.replace(/WHERE\s+o\.status\s*=\s*['\"]\w+['\"]/i, '');
          if (fallbackQuery === sqlQuery) {
            fallbackQuery = sqlQuery.replace(/WHERE\s+o\.status\s*=\s*['\"]\w+['\"]/i, "WHERE o.status IN ('delivered','shipped','processing')");
          }
          if (fallbackQuery === sqlQuery) {
            fallbackQuery = sqlQuery.replace(/WHERE[\s\S]*?(GROUP BY|ORDER BY|LIMIT)/i, '$1');
          }
          let fallbackResult = [];
          try {
            fallbackResult = await DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, fallbackQuery);
          } catch (fallbackError) {
            console.log('Fallback query failed:', fallbackError);
          }
          queryResult = fallbackResult.length > 0 ? fallbackResult : mainQueryResult;
        } else {
          queryResult = mainQueryResult;
        }
      } catch (error) {
        sqlError = error;
        // If SQL execution fails, re-prompt LLM with explicit alias/column instructions
        const errorMsg = error instanceof Error ? error.message : String(error);
        const fixPrompt = `${sqlPrompt}\n\nThe previous query failed with the following error for ${schema.databaseType}:\n${errorMsg}\nYou used an alias or column that does not exist or is not defined at the point of use. Double-check that all table aliases are defined before use, all columns referenced in JOINs exist in the correct tables, and fix any alias/column issues. Use only MySQL 8.0 compatible syntax. Do not use multiple CTEs. Do not use double quotes for table or column names. Use IN ('delivered','shipped','processing') for order status if needed.`;
        try {
          const fixResult = await openAIQueryLLM.call({ prompt: fixPrompt });
          sqlQuery = fixResult.text.trim().replace(/```sql|```/gi, '').trim();
          const sqlMatch2 = sqlQuery.match(/SELECT[\s\S]*/i);
          if (sqlMatch2) {
            sqlQuery = sqlMatch2[0].trim();
          } else {
            throw new Error('Only SELECT queries are allowed for marketing plan generation.');
          }
          if (schema.databaseType === 'mysql') {
            sqlQuery = sqlQuery.replace(/"/g, '`');
          }
          queryResult = await DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, sqlQuery);
        } catch (secondError) {
          // If the LLM fails twice, fall back to a simple query
          let fallbackQuery = '';
          if (schema.tables.some(t => t.name === 'products')) {
            fallbackQuery = 'SELECT name, description, price FROM products LIMIT 10;';
          } else if (schema.tables.some(t => t.name === 'services')) {
            fallbackQuery = 'SELECT name, description, sales_price as price FROM services LIMIT 10;';
          } else {
            fallbackQuery = 'SELECT * FROM information_schema.tables LIMIT 10;';
          }
          try {
            queryResult = await DatabaseConnectionService.executeQuery(databaseInfo.connectionString, databaseInfo.type, fallbackQuery);
          } catch (finalError) {
            // If even the fallback fails, return a clear error
            return res.status(500).json({
              success: false,
              error: 'Failed to generate marketing plan',
              message: finalError instanceof Error ? finalError.message : 'Unknown error'
            });
          }
        }
      }
      if (!Array.isArray(queryResult)) {
        if (queryResult === undefined || queryResult === null) {
          queryResult = [];
        } else {
          queryResult = [queryResult];
        }
      }
      // Remove or comment out all console.log statements related to SQL and data in generateMarketingPlan
      if (queryResult.length === 0) {
        return res.status(200).json({
          success: false,
          error: 'No data found for your request. Please check your filters or ensure your database contains relevant data.',
          plan: '',
          imageUrl: '',
          query: sqlQuery,
          rateLimit: {
            remaining: rateLimit.remaining,
            resetTime: rateLimit.resetTime
          }
        });
      }

      // 5. LLM: Generate detailed marketing plan using GPT-4o
      const dataContext = Array.isArray(queryResult) ? JSON.stringify(queryResult, null, 2) : String(queryResult);
      
      // Create a comprehensive marketing plan prompt with specific requirements
      const detailedPlanPrompt = `You are a world-class marketing strategist and business consultant with 20+ years of experience. Based on the following business data, generate a MASSIVE, comprehensive, highly detailed, and actionable marketing plan that is at least 3-4 times larger than a standard marketing plan.

BUSINESS DATA ANALYSIS:
${dataContext}

REQUIREMENTS FOR THE MARKETING PLAN:

1. **EXECUTIVE SUMMARY** (4-5 detailed paragraphs)
   - Comprehensive business insights and data analysis
   - Current market position assessment with specific metrics
   - Critical opportunities and challenges identified with data backing
   - Key performance indicators and success metrics
   - Strategic vision and mission alignment

2. **MARKET ANALYSIS** (Extensive detailed section)
   - Target market identification with detailed demographics and psychographics
   - Competitive landscape analysis with specific competitor profiles
   - Market trends and opportunities with industry-specific insights
   - Customer segmentation analysis with behavioral patterns
   - Market size and growth potential analysis
   - Geographic market analysis and expansion opportunities
   - Seasonal trends and cyclical patterns
   - Regulatory environment and compliance considerations

3. **PRODUCT/SERVICE STRATEGY** (Comprehensive recommendations)
   - Detailed product portfolio analysis with performance metrics
   - Pricing strategy recommendations with competitive analysis
   - Product positioning and differentiation strategies
   - New product development roadmap and innovation pipeline
   - Inventory and supply chain optimization strategies
   - Product lifecycle management and phase-out strategies
   - Quality assurance and customer satisfaction metrics
   - Product bundling and cross-selling opportunities
   - Service delivery optimization and customer experience enhancement

4. **CUSTOMER ACQUISITION STRATEGY** (Extensive tactics)
   - Digital marketing channels with detailed implementation plans
   - Content marketing strategy with content calendar and themes
   - Lead generation tactics with specific conversion funnel optimization
   - Customer acquisition cost optimization and ROI analysis
   - Referral and partnership programs with incentive structures
   - Influencer marketing and brand ambassador programs
   - Event marketing and trade show strategies
   - Public relations and media outreach campaigns
   - Affiliate marketing and commission structures
   - Mobile marketing and app-based acquisition strategies

5. **CUSTOMER RETENTION & LOYALTY** (Comprehensive programs)
   - Customer lifecycle management with detailed journey mapping
   - Loyalty program design with tier structures and rewards
   - Customer service excellence initiatives and training programs
   - Upselling and cross-selling strategies with specific tactics
   - Customer feedback and improvement systems
   - Customer advocacy and word-of-mouth programs
   - Personalized marketing and recommendation engines
   - Customer education and onboarding programs
   - Community building and engagement strategies
   - Customer win-back and reactivation campaigns

6. **SALES STRATEGY** (Extensive revenue optimization)
   - Sales process optimization with detailed workflow analysis
   - Sales team training and development programs with curriculum
   - Sales forecasting and goal setting with predictive analytics
   - Commission and incentive structures with performance metrics
   - Sales technology and CRM optimization with specific tools
   - Territory management and account assignment strategies
   - Sales enablement and content development
   - Pipeline management and lead qualification processes
   - Sales performance analytics and reporting systems
   - Channel partner and distributor strategies

7. **DIGITAL TRANSFORMATION** (Comprehensive technology integration)
   - E-commerce optimization strategies with conversion rate optimization
   - Mobile marketing and app development with user experience design
   - Data analytics and business intelligence with dashboard development
   - Marketing automation implementation with workflow design
   - Customer experience (CX) enhancement with journey optimization
   - Artificial intelligence and machine learning applications
   - Social media management and community engagement
   - Email marketing automation and personalization
   - Search engine optimization and content strategy
   - Paid advertising and PPC campaign management

8. **BUDGET ALLOCATION** (Detailed financial planning)
   - Marketing budget breakdown by channel with specific allocations
   - ROI projections and measurement metrics with tracking systems
   - Cost-per-acquisition targets with optimization strategies
   - Revenue growth projections with scenario analysis
   - Resource allocation recommendations with staffing plans
   - Marketing technology stack investment and ROI analysis
   - Contingency budget planning and risk mitigation
   - Performance-based budget allocation and optimization
   - Cross-channel budget optimization and attribution modeling
   - Long-term investment planning and capital allocation

9. **IMPLEMENTATION TIMELINE** (Comprehensive action plan)
   - 30-day immediate action items with daily/weekly milestones
   - 90-day short-term goals with monthly checkpoints
   - 6-month medium-term objectives with quarterly reviews
   - 12-month long-term vision with annual planning cycles
   - Key milestones and success metrics with tracking systems
   - Resource allocation and team assignment schedules
   - Technology implementation and training timelines
   - Performance measurement and optimization cycles
   - Risk mitigation and contingency planning schedules
   - Stakeholder communication and reporting schedules

10. **RISK MANAGEMENT** (Extensive contingency planning)
    - Market risks and mitigation strategies with scenario planning
    - Competitive threats and responses with monitoring systems
    - Technology risks and backup plans with disaster recovery
    - Financial risks and safeguards with insurance and hedging
    - Crisis management protocols with communication strategies
    - Regulatory compliance and legal risk management
    - Supply chain risks and alternative sourcing strategies
    - Cybersecurity and data protection measures
    - Reputation management and brand protection strategies
    - Operational risks and business continuity planning

11. **PERFORMANCE MEASUREMENT & ANALYTICS** (Comprehensive tracking)
    - Key Performance Indicators (KPIs) with specific targets
    - Marketing attribution and ROI measurement systems
    - Customer lifetime value analysis and optimization
    - Conversion funnel analysis and optimization
    - A/B testing strategies and statistical significance
    - Real-time dashboard development and reporting
    - Predictive analytics and forecasting models
    - Competitive benchmarking and market intelligence
    - Customer satisfaction and Net Promoter Score tracking
    - Marketing efficiency and productivity metrics

12. **ORGANIZATIONAL STRUCTURE & TEAM DEVELOPMENT** (Detailed planning)
    - Marketing team structure and role definitions
    - Skills development and training programs
    - Performance management and incentive systems
    - Cross-functional collaboration and communication
    - Agency and vendor management strategies
    - Knowledge management and best practices sharing
    - Innovation and creative development processes
    - Change management and organizational development
    - Leadership development and succession planning
    - Culture building and team engagement strategies

FORMATTING REQUIREMENTS:
- Use rich markdown formatting with headers, subheaders, bullet points, and numbered lists
- Include specific data references and metrics from the provided business data
- Use tables, charts (ASCII art), and visual elements where appropriate
- Make each recommendation specific and actionable with implementation steps
- Include success metrics and KPIs for each strategy with specific targets
- Use professional business language while remaining engaging and readable
- Structure the plan for easy reading and implementation with clear sections
- Include detailed examples and case studies where relevant
- Provide step-by-step implementation guides for complex strategies
- Include troubleshooting guides and common pitfalls to avoid

IMPORTANT:
- Every recommendation MUST be based on the actual data provided
- Reference specific products, services, sales figures, and customer data throughout
- Provide concrete, implementable actions with specific timelines and responsibilities
- Include specific timelines, budgets, and success metrics for every strategy
- Make the plan comprehensive enough for immediate implementation by multiple teams
- Include detailed cost-benefit analysis for major initiatives
- Provide alternative strategies and contingency plans for critical areas
- Include stakeholder communication plans and change management strategies

Generate a MASSIVE, comprehensive marketing plan that would be suitable for presentation to senior management, board of directors, and immediate execution by multiple marketing teams. This should be the most detailed and actionable marketing plan possible, covering every aspect of modern marketing strategy and implementation.`;
      
      // Use GPT-4o for enhanced marketing plan generation
      const { OpenAILLM } = await import('../configs/langchain');
      const gpt4oLLM = new OpenAILLM('gpt-4o');
      const planResult = await gpt4oLLM.call({ prompt: detailedPlanPrompt });
      const plan = planResult.text;

      // 6. Generate DALL-E 3 image only if generateImage is true (default: true)
      let imageUrl = '';
      if (generateImage !== false) {
        // Always extract the top 3 most frequent product/service names
        let productNames: string[] = [];
        if (Array.isArray(queryResult) && queryResult.length > 0) {
          const nameCounts: Record<string, number> = {};
          queryResult.forEach(row => {
            const name = row.product_name || row.name || row.service_name;
            if (name && typeof name === 'string') {
              nameCounts[name] = (nameCounts[name] || 0) + 1;
            }
          });
          productNames = Object.entries(nameCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name)
            .slice(0, 3);
        }
        const { generateDalleImage } = await import('../utils/marketingImage');
        imageUrl = await generateDalleImage('', productNames);
      }

      return res.status(200).json({
        success: true,
        plan,
        imageUrl,
        query: sqlQuery,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime
        }
      });
    } catch (error) {
      console.error('Marketing plan generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate marketing plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 