# Edarah Backend Troubleshooting Guide

## Common Issues and Solutions

### 1. JSON Parsing Errors

#### Issue: "Unexpected token '`', \"```json\n{\n\"... is not valid JSON"

**Problem**: The LLM (Language Model) is returning JSON wrapped in markdown code blocks instead of pure JSON.

**Solution**: The code has been updated to handle markdown-formatted JSON responses by:
- Removing markdown code blocks (````json` and ````)
- Trimming whitespace
- Providing better error logging

**Fixed in**:
- `src/controllers/dashboard.controller.ts` - `analyzeProduct` function
- `src/controllers/dashboard.controller.ts` - `getAITable` function

**Code Example**:
```typescript
let responseText = analysisResult.text;

// Handle markdown-formatted JSON responses
if (typeof responseText === 'string') {
  // Remove markdown code blocks
  responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
  // Remove any leading/trailing whitespace
  responseText = responseText.trim();
}

structured = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
```

### 2. Foreign Key Constraint Violations

#### Issue: "Foreign key constraint violated on the constraint: `user_databases_user_id_fkey`"

**Problem**: The user ID from JWT token is not being properly converted to BigInt for database operations.

**Root Cause**: 
- JWT payload contains `userId` as a string
- Prisma expects BigInt for user ID fields
- Direct conversion `BigInt(userId)` fails when userId is already a string

**Solution**: Always convert userId to string first, then to BigInt:
```typescript
user_id: BigInt(userId.toString())
```

**Fixed in**:
- `src/controllers/rag.controller.ts` - All database operations
- `src/controllers/dashboard.controller.ts` - All user ID references

### 3. Database Connection Issues

#### Issue: "Database connection failed"

**Common Causes**:
1. Invalid connection string format
2. Database server not running
3. Network connectivity issues
4. Authentication credentials

**Troubleshooting Steps**:
1. Verify connection string format for your database type
2. Test connection manually using database client
3. Check if database server is running
4. Verify network connectivity
5. Check authentication credentials

**Connection String Examples**:
```bash
# PostgreSQL
postgresql://username:password@host:port/database

# MySQL
mysql://username:password@host:port/database

# MongoDB
mongodb://username:password@host:port/database
```

### 4. Authentication Issues

#### Issue: "User not authenticated" or "Token is invalid or expired"

**Common Causes**:
1. Missing or invalid JWT token
2. Expired token
3. Incorrect token format
4. Missing Authorization header

**Solution**:
1. Ensure token is included in Authorization header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```
2. Check if token is expired (default: 7 days)
3. Re-authenticate if token is expired
4. Verify token format and signature

### 5. Rate Limiting Issues

#### Issue: "Rate limit exceeded"

**Problem**: User has exceeded their plan's rate limits.

**Solution**:
1. Check current usage: `GET /api/rag/rate-limit`
2. Upgrade plan if needed
3. Wait for rate limit reset
4. Clear cache if applicable

### 6. Database Schema Issues

#### Issue: "Column not found" or "Table not found"

**Common Causes**:
1. Database schema has changed
2. Incorrect table/column names
3. Database type mismatch

**Solution**:
1. Refresh database schema: `GET /api/rag/databases/:databaseId/schema`
2. Verify table and column names
3. Check database type compatibility
4. Reconnect database if needed

### 7. Memory and Cache Issues

#### Issue: "Memory not found" or cache-related errors

**Solution**:
1. Clear user memory: `DELETE /api/rag/memory/clear`
2. Clear user cache: `DELETE /api/rag/cache/user`
3. Clear database cache: `DELETE /api/rag/cache/database/:databaseId`
4. Clear all cache: `DELETE /api/rag/cache/all`

## Debugging Tips

### 1. Enable Detailed Logging

Add these environment variables for detailed logging:
```bash
NODE_ENV=development
DEBUG=prisma:*
```

### 2. Check Database Logs

Monitor database connection and query logs:
```bash
# PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log

# MySQL
tail -f /var/log/mysql/error.log
```

### 3. Test Database Connection

Use the test endpoint to verify database connectivity:
```bash
curl -X POST /api/rag/databases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "connectionString": "your-connection-string",
    "databaseName": "your-database-name"
  }'
```

### 4. Monitor API Responses

Check response headers and body for error details:
```bash
curl -v -X POST /api/dashboard/product-analysis \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "test-product",
    "databaseId": "your-database-id"
  }'
```

## Performance Optimization

### 1. Database Connection Pooling

Configure connection pooling in your database connection string:
```bash
# PostgreSQL
postgresql://user:pass@host:port/db?connection_limit=10&pool_timeout=20

# MySQL
mysql://user:pass@host:port/db?connectionLimit=10&acquireTimeout=20000
```

### 2. Cache Management

Regularly clean up expired cache entries:
```bash
POST /api/rag/cache/cleanup
```

### 3. Vector Store Optimization

Clear vector stores for unused databases:
```bash
DELETE /api/rag/databases/:databaseId/vector-store
```

## Environment Variables

Ensure these environment variables are properly set:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:port/db"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Paymob (for payments)
PAYMOB_API_KEY="your-paymob-api-key"
PAYMOB_INTEGRATION_ID="your-integration-id"

# Server
PORT=3000
NODE_ENV=development
```

## Health Check

Use the health check endpoint to verify server status:
```bash
GET /api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Support

If you continue to experience issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test database connectivity manually
4. Review the API documentation for correct endpoint usage
5. Check if the issue is related to rate limiting or plan restrictions 