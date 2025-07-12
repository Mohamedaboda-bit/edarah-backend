"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("./routes/auth"));
const plans_1 = __importDefault(require("./routes/plans"));
const paymobWebook_1 = __importDefault(require("./routes/paymobWebook"));
const rag_1 = __importDefault(require("./routes/rag"));
// Initialize LangChain configuration
require("./configs/langchain");
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 3000;
// Initialize Prisma client
exports.prisma = new client_1.PrismaClient();
// Middleware
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for development
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/plan', plans_1.default);
app.use('/api/paymob', paymobWebook_1.default);
app.use('/api/rag', rag_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${port}`);
    console.log(`📊 Health check: http://0.0.0.0:${port}/api/health`);
});
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await exports.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    await exports.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map