import { Router } from 'express';
import { RAGController } from '../controllers/rag.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all RAG routes
router.use(authenticateToken);

// Main analysis endpoint
router.post('/analyze', RAGController.analyzeData);

// Database management endpoints
router.post('/databases', RAGController.connectDatabase);
router.get('/databases', RAGController.getUserDatabases);
router.get('/databases/:databaseId/schema', RAGController.getDatabaseSchema);
router.delete('/databases/:databaseId', RAGController.removeDatabase);

// Vector store endpoints
router.get('/databases/:databaseId/context', RAGController.getHistoricalContext);
router.delete('/databases/:databaseId/vector-store', RAGController.clearVectorStore);

// Rate limiting endpoint
router.get('/rate-limit', RAGController.getRateLimitInfo);

// Memory endpoints
router.get('/memory', RAGController.getUserMemory);
router.get('/memory/history', RAGController.getConversationHistory);
router.delete('/memory/clear', RAGController.clearUserMemory);

export default router; 