# Edarah Backend API Documentation

## Overview
Edarah is a backend service that provides RAG (Retrieval-Augmented Generation) capabilities for database analysis, marketing plan generation, and user management with subscription plans.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 1. Authentication Endpoints

### 1.1 Register User
**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "firstName": "string",
  "lastName": "string", 
  "email": "string",
  "password": "string",
  "phoneNumber": "string"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "string",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "role": "client",
    "phone_number": "string",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "token": "jwt-token"
}
```

### 1.2 Login User
**POST** `/auth/login`

Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "string",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "role": "client|admin|support",
    "phone_number": "string",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "token": "jwt-token"
}
```

### 1.3 Get User Profile
**GET** `/auth/me`

Get current user's profile information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "string",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "role": "client|admin|support",
    "phone_number": "string",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### 1.4 Logout User
**POST** `/auth/logout`

Logout user (client-side token removal).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### 1.5 Refresh Token
**POST** `/auth/refresh`

Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "token": "new-jwt-token"
}
```

---

## 2. Plans & Subscription Endpoints

### 2.1 List Available Plans
**GET** `/plan/listPlans`

Get all active subscription plans.

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "free|pro|business",
    "description": "string",
    "features": "json",
    "price": 0,
    "is_active": true,
    "token_limit": 1000,
    "database_limit_number": 1
  }
]
```

### 2.2 Buy Plan
**POST** `/plan/buy/:id`

Purchase a subscription plan.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment-id",
    "amount_cents": 1000,
    "currency": "EGP",
    "payment_integration_id": 123,
    "order": {
      "id": "order-id",
      "created_at": "datetime",
      "delivery_needed": false,
      "merchant": {},
      "collector": {},
      "amount_cents": 1000,
      "currency": "EGP",
      "is_payment_locked": false,
      "is_return": false,
      "is_cancel": false,
      "is_returned": false,
      "is_canceled": false,
      "merchant_order_id": "string",
      "wallet_notification": null,
      "paid_amount_cents": 0,
      "paid_amount": 0,
      "items": []
    },
    "is_void": false,
    "is_refunded": false,
    "is_captured": false,
    "is_voided": false,
    "bill_balanced": false,
    "captured_amount": 0,
    "captured_amount_cents": 0,
    "refunded_amount_cents": 0,
    "refunded_amount": 0,
    "order_id": "order-id",
    "id": "payment-id",
    "created_at": "datetime",
    "transaction_processed_callback_already_sent": false,
    "amount": 10,
    "reference": "string",
    "source_data_pan": "string",
    "source_data_type": "string",
    "source_data_brand": "string",
    "hmac": "string"
  }
}
```

### 2.3 Add Plan (Admin Only)
**POST** `/plan/addPlan`

Create a new subscription plan (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "free|pro|business",
  "features": "json",
  "price": 0,
  "is_active": true,
  "token_limit": 1000
}
```

**Response (201):**
```json
{
  "id": 1,
  "name": "free",
  "features": "json",
  "price": 0,
  "is_active": true,
  "token_limit": 1000,
  "database_limit_number": 1
}
```

---

## 3. RAG (Retrieval-Augmented Generation) Endpoints

### 3.1 Analyze Data
**POST** `/rag/analyze`

Analyze database data using RAG.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "string",
  "databaseId": "string",
  "context": "string"
}
```

**Response (200):**
```json
{
  "analysis": "string",
  "recommendations": ["string"],
  "insights": ["string"]
}
```

### 3.2 Generate Marketing Plan
**POST** `/rag/marketing-plan`

Generate marketing plan based on data analysis.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "databaseId": "string",
  "businessContext": "string",
  "targetAudience": "string"
}
```

**Response (200):**
```json
{
  "marketingPlan": {
    "strategy": "string",
    "channels": ["string"],
    "timeline": "string",
    "budget": "string"
  }
}
```

### 3.3 Expand Recommendation
**POST** `/rag/recommendation/explain`

Get detailed explanation of a recommendation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "recommendation": "string",
  "databaseId": "string"
}
```

**Response (200):**
```json
{
  "explanation": "string",
  "implementation": "string",
  "expectedOutcome": "string"
}
```

### 3.4 Database Management

#### 3.4.1 Connect Database
**POST** `/rag/databases`

Connect a new database to the system.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "databaseType": "postgresql|mysql|mongodb|sqlserver|sqlite",
  "connectionString": "string",
  "databaseName": "string"
}
```

**Response (200):**
```json
{
  "id": "string",
  "databaseType": "string",
  "databaseName": "string",
  "isActive": true,
  "createdAt": "datetime"
}
```

#### 3.4.2 Get User Databases
**GET** `/rag/databases`

Get all databases connected by the user.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "string",
    "databaseType": "string",
    "databaseName": "string",
    "isActive": true,
    "createdAt": "datetime",
    "lastSchemaUpdate": "datetime"
  }
]
```

#### 3.4.3 Get Database Schema
**GET** `/rag/databases/:databaseId/schema`

Get the schema of a specific database.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "schema": "json",
  "lastUpdated": "datetime"
}
```

#### 3.4.4 Remove Database
**DELETE** `/rag/databases/:databaseId`

Remove a database connection.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Database removed successfully"
}
```

### 3.5 Vector Store Management

#### 3.5.1 Get Historical Context
**GET** `/rag/databases/:databaseId/context`

Get historical context for a database.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "context": "string",
  "lastUpdated": "datetime"
}
```

#### 3.5.2 Clear Vector Store
**DELETE** `/rag/databases/:databaseId/vector-store`

Clear vector store for a database.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Vector store cleared successfully"
}
```

### 3.6 Rate Limiting

#### 3.6.1 Get Rate Limit Info
**GET** `/rag/rate-limit`

Get current rate limit information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "remaining": 100,
  "limit": 1000,
  "resetTime": "datetime"
}
```

### 3.7 Memory Management

#### 3.7.1 Get User Memory
**GET** `/rag/memory`

Get user's conversation memory.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "memory": "string",
  "lastUpdated": "datetime"
}
```

#### 3.7.2 Get Conversation History
**GET** `/rag/memory/history`

Get conversation history.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "string",
    "message": "string",
    "timestamp": "datetime",
    "type": "user|assistant"
  }
]
```

#### 3.7.3 Clear User Memory
**DELETE** `/rag/memory/clear`

Clear user's conversation memory.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Memory cleared successfully"
}
```

### 3.8 Cache Management

#### 3.8.1 Get Cache Stats
**GET** `/rag/cache/stats`

Get cache statistics.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "totalEntries": 100,
  "hitRate": 0.85,
  "size": "10MB"
}
```

#### 3.8.2 Clear User Cache
**DELETE** `/rag/cache/user`

Clear user's cache.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "User cache cleared successfully"
}
```

#### 3.8.3 Clear Database Cache
**DELETE** `/rag/cache/database/:databaseId`

Clear cache for a specific database.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Database cache cleared successfully"
}
```

#### 3.8.4 Clear All Cache
**DELETE** `/rag/cache/all`

Clear all cache.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "All cache cleared successfully"
}
```

#### 3.8.5 Cleanup Expired Cache
**POST** `/rag/cache/cleanup`

Clean up expired cache entries.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Expired cache cleaned up successfully",
  "clearedEntries": 50
}
```

---

## 4. Dashboard Endpoints

### 4.1 Get Dashboard Analysis
**GET** `/dashboard/analysis`

Get dashboard analysis data.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "analysis": "string",
  "metrics": {
    "totalUsers": 100,
    "activeUsers": 80,
    "totalRevenue": 10000
  }
}
```

### 4.2 Get AI Table
**GET** `/dashboard/ai-table`

Get AI-generated table data.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "table": "json",
  "columns": ["string"],
  "rows": ["json"]
}
```

### 4.3 Analyze Product
**POST** `/dashboard/product-analysis`

Analyze product data.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "productId": "string",
  "analysisType": "string"
}
```

**Response (200):**
```json
{
  "analysis": "string",
  "recommendations": ["string"],
  "metrics": "json"
}
```

---

## 5. Payment Webhook Endpoints

### 5.1 Paymob Webhook
**POST** `/paymob/webhook`

Handle Paymob payment webhooks.

**Request Body:**
```json
{
  "type": "string",
  "obj": "json"
}
```

**Response (200):**
```json
{
  "status": "success"
}
```

---

## 6. Health Check

### 6.1 Health Check
**GET** `/health`

Check server health status.

**Response (200):**
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "datetime"
}
```

---

## Database Schema

### Enums

#### PlanName
- `free`
- `pro` 
- `business`

#### UserRole
- `client`
- `admin`
- `support`

#### NotificationTypeEnum
- `PLACEHOLDER` (Temporary value, will be edited later)

### Tables

#### 1. plans
| Column | Type | Description |
|--------|------|-------------|
| id | Int | Primary key, auto-increment |
| name | PlanName | Plan name (free/pro/business) |
| description | String? | Optional plan description |
| features | Json | Plan features as JSON |
| price | Int | Plan price in cents |
| is_active | Boolean | Whether plan is active |
| token_limit | Int | Token usage limit |
| database_limit_number | Int | Maximum number of databases allowed |

#### 2. users
| Column | Type | Description |
|--------|------|-------------|
| id | BigInt | Primary key, auto-increment |
| first_name | String | User's first name |
| last_name | String | User's last name |
| email | String | Unique email address |
| role | UserRole | User role (client/admin/support) |
| password | String | Hashed password |
| created_at | DateTime | Account creation timestamp |
| updated_at | DateTime | Last update timestamp |
| phone_number | String | User's phone number |

#### 3. user_plans
| Column | Type | Description |
|--------|------|-------------|
| id | BigInt | Primary key, auto-increment |
| user_id | BigInt | Foreign key to users.id |
| plan_id | Int | Foreign key to plans.id |
| start_date | DateTime | Plan start date |
| end_date | DateTime? | Plan end date (null if active) |
| is_active | Boolean | Whether plan is currently active |
| tokens_used | Int | Number of tokens used |

#### 4. user_databases
| Column | Type | Description |
|--------|------|-------------|
| id | BigInt | Primary key, auto-increment |
| user_id | BigInt | Foreign key to users.id |
| database_type | String | Database type (postgresql/mysql/mongodb/etc.) |
| connection_string | String | Encrypted connection string |
| database_name | String? | Database name |
| schema_cache | Json? | Cached schema for performance |
| last_schema_update | DateTime | Last schema update timestamp |
| is_active | Boolean | Whether database connection is active |
| created_at | DateTime | Connection creation timestamp |
| updated_at | DateTime | Last update timestamp |

#### 5. conversations
| Column | Type | Description |
|--------|------|-------------|
| id | Int | Primary key, auto-increment |
| participant_1 | BigInt | Foreign key to users.id |
| participant_2 | BigInt | Foreign key to users.id |
| updated_at | DateTime | Last update timestamp |
| created_at | DateTime | Conversation creation timestamp |

#### 6. messages
| Column | Type | Description |
|--------|------|-------------|
| id | BigInt | Primary key, auto-increment |
| is_read | Boolean | Whether message is read |
| sent_at | DateTime | Message sent timestamp |
| conversation_id | Int | Foreign key to conversations.id |
| has_attachment | Boolean | Whether message has attachment |
| sender_id | BigInt | Foreign key to users.id |
| message | String | Message content |

#### 7. message_attachment
| Column | Type | Description |
|--------|------|-------------|
| id | BigInt | Primary key, auto-increment |
| message_id | BigInt | Foreign key to messages.id |
| attachment_url | String | Attachment file URL |
| uploaded_at | DateTime | Upload timestamp |

#### 8. notifications
| Column | Type | Description |
|--------|------|-------------|
| id | BigInt | Primary key, auto-increment |
| user_id | BigInt | Foreign key to users.id |
| type | NotificationTypeEnum | Notification type |
| title | String | Notification title |
| message | String? | Notification message |
| is_read | Boolean | Whether notification is read |
| created_at | DateTime | Notification creation timestamp |

### Relationships

- **users** ↔ **user_plans**: One-to-many
- **plans** ↔ **user_plans**: One-to-many  
- **users** ↔ **user_databases**: One-to-many
- **users** ↔ **conversations**: Many-to-many (participant_1, participant_2)
- **conversations** ↔ **messages**: One-to-many
- **messages** ↔ **message_attachment**: One-to-many
- **users** ↔ **notifications**: One-to-many

### Constraints

- `user_plans`: Unique constraint on `[user_id, plan_id]`
- `user_databases`: Unique constraint on `[user_id, database_name]`
- `users.email`: Unique constraint
- `plans.name`: Unique constraint

---

## Error Responses

### Standard Error Format
```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error details (optional)"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

---

## Rate Limiting

The API implements rate limiting based on user subscription plans:
- **Free Plan**: Limited requests per hour
- **Pro Plan**: Higher limits
- **Business Plan**: Highest limits

Rate limit information is returned in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

---

## Security

- JWT-based authentication
- Password hashing using bcrypt
- Encrypted database connection strings
- CORS enabled for cross-origin requests
- Input validation on all endpoints
- Role-based access control (RBAC) 