"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rag_controller_1 = require("../controllers/rag.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Apply authentication middleware to all RAG routes
router.use(auth_1.authenticateToken);
// Main analysis endpoint
router.post('/analyze', rag_controller_1.RAGController.analyzeData);
// Database management endpoints
router.post('/databases', rag_controller_1.RAGController.connectDatabase);
router.get('/databases', rag_controller_1.RAGController.getUserDatabases);
router.get('/databases/:databaseId/schema', rag_controller_1.RAGController.getDatabaseSchema);
router.delete('/databases/:databaseId', rag_controller_1.RAGController.removeDatabase);
// Vector store endpoints
router.get('/databases/:databaseId/context', rag_controller_1.RAGController.getHistoricalContext);
router.delete('/databases/:databaseId/vector-store', rag_controller_1.RAGController.clearVectorStore);
// Rate limiting endpoint
router.get('/rate-limit', rag_controller_1.RAGController.getRateLimitInfo);
// Memory endpoints
router.get('/memory', rag_controller_1.RAGController.getUserMemory);
router.get('/memory/history', rag_controller_1.RAGController.getConversationHistory);
router.delete('/memory/clear', rag_controller_1.RAGController.clearUserMemory);
exports.default = router;
//# sourceMappingURL=rag.js.map