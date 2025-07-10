# Edarah Backend API Documentation

## Base URL

```
http://<host>:<port>/api/
```

---

## Table of Contents

- [Authentication](#authentication)
- [RAG (Retrieval-Augmented Generation)](#rag-retrieval-augmented-generation)
- [Plans & Payments](#plans--payments)
- [Health Check](#health-check)
- [Error Handling](#error-handling)

---

## Authentication

**Base Path:** `/api/auth`

| Method | Endpoint         | Description                | Auth Required | Request Body / Params | Response |
|--------|------------------|----------------------------|---------------|----------------------|----------|
| POST   | `/register`      | Register a new user        | No            | `{ firstName, lastName, email, password, phoneNumber }` | `{ message, user, token }` |
| POST   | `/login`         | Login user                 | No            | `{ email, password }` | `{ message, user, token }` |
| GET    | `/me`            | Get current user profile   | Yes (JWT)     | -                    | `{ user }` |
| POST   | `/logout`        | Logout user (client-side)  | Yes (JWT)     | -                    | `{ message, note }` |
| POST   | `/refresh`       | Refresh JWT token          | Yes (JWT)     | -                    | `{ message, token }` |

**Request Body Details:**

- **Register:** All fields required. Password must be at least 8 chars, with uppercase, lowercase, number, and special character. Phone must be valid.
- **Login:** Email and password required.

**Response Example:**
```json
{
  "message": "User registered successfully",
  "user": { "id": "1", "first_name": "...", "last_name": "...", "email": "...", ... },
  "token": "JWT_TOKEN"
}
```

---

## RAG (Retrieval-Augmented Generation)

**Base Path:** `/api/rag`  
**All endpoints require JWT authentication.**

### Main Analysis

| Method | Endpoint         | Description                | Request Body / Params | Response |
|--------|------------------|----------------------------|----------------------|----------|
| POST   | `/analyze`       | Analyze business data and provide insights | `{ question, databaseId?, context? }` | `{ success, message, data, rateLimit }` |

### Database Management

| Method | Endpoint         | Description                | Request Body / Params | Response |
|--------|------------------|----------------------------|----------------------|----------|
| POST   | `/databases`     | Add or update database connection | `{ connectionString, databaseName? }` | `{ success, message, data }` |
| GET    | `/databases`     | List user's databases      | -                    | `{ success, data }` |
| GET    | `/databases/:databaseId/schema` | Get database schema | - | `{ success, data }` |
| DELETE | `/databases/:databaseId` | Remove database connection | - | `{ success, message }` |

### Vector Store

| Method | Endpoint         | Description                | Request Body / Params | Response |
|--------|------------------|----------------------------|----------------------|----------|
| GET    | `/databases/:databaseId/context` | Get historical context | `question` (query param), `limit?` | `{ success, data: { context } }` |
| DELETE | `/databases/:databaseId/vector-store` | Clear vector store | - | `{ success, message }` |

### Rate Limiting

| Method | Endpoint         | Description                | Request Body / Params | Response |
|--------|------------------|----------------------------|----------------------|----------|
| GET    | `/rate-limit`    | Get rate limit info        | -                    | `{ success, data }` |

---

## Plans & Payments

### Plans

**Base Path:** `/api/plan`

| Method | Endpoint         | Description                | Auth Required | Request Body / Params | Response |
|--------|------------------|----------------------------|---------------|----------------------|----------|
| POST   | `/addPlan`       | Add a new plan             | Yes (Admin)   | `{ name, features, price, is_active, token_limit }` | Plan object |
| GET    | `/listPlans`     | List all active plans      | No            | -                    | `[Plan, ...]` |

**Plan Name Options:** `free`, `pro`, `business`

**Features** must be an object.  
**Price** is an integer.  
**is_active** is a boolean.  
**token_limit** is an integer.

### Buy Plan

| Method | Endpoint         | Description                | Auth Required | Request Body / Params | Response |
|--------|------------------|----------------------------|---------------|----------------------|----------|
| POST   | `/buy/:id`       | Purchase a plan            | Yes (JWT)     | `:id` = plan ID (URL param) | `{ success, data: { paymentLink, plan } }` |

### Paymob Webhook

**Base Path:** `/api/paymob`

| Method | Endpoint         | Description                | Auth Required | Request Body / Params | Response |
|--------|------------------|----------------------------|---------------|----------------------|----------|
| POST   | `/webhook`       | Paymob payment webhook     | No            | Paymob payload       | `200 OK` or error |

---

## Health Check

| Method | Endpoint         | Description                | Auth Required | Response |
|--------|------------------|----------------------------|---------------|----------|
| GET    | `/api/health`    | Server health check        | No            | `{ status, message, timestamp }` |

---

## Error Handling

- All error responses follow the format:
```json
{
  "success": false,
  "error": "Error message"
}
```
or for validation:
```json
{
  "error": "Validation failed",
  "message": "Please check your input",
  "details": [ ... ]
}
```

---

## Authentication

- All endpoints requiring authentication expect a JWT in the `Authorization` header as `Bearer <token>`.
- Admin-only endpoints require the user to have the `admin` role.

---

## Example JWT Payload

```json
{
  "userId": "1",
  "email": "user@example.com",
  "role": "client",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+201234567890"
}
``` 