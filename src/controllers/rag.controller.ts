import { Request, Response } from 'express';
import { RAGService, RAGRequest } from '../utils/ragService';
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

      const { question, databaseId, context } = req.body;

      // Validate required fields
      if (!question) {
        return res.status(400).json({ success: false, error: 'Question is required' });
      }

      // Process RAG request
      const ragRequest: RAGRequest = {
        question,
        userId,
        databaseId,
        context
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
} 