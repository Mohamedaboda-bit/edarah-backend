# Smart Question Classification System

## Overview

The Smart Question Classification System automatically determines whether a user's question requires database analysis or can be answered from conversation history and general knowledge. This intelligent routing system enhances user experience by providing faster, more contextual responses.

## 🎯 **Problem Solved**

**Before**: All questions went through the full RAG pipeline (SQL generation → Database query → Analysis), even for simple questions like "What is my name?" or "What's today's date?"

**After**: Questions are intelligently classified and routed to the most appropriate processing path, saving time and resources.

## 🔧 **System Architecture**

### **Classification Layer**
```
User Question → Question Classifier → Route Decision → Processing Path
                     ↓
              [Database Path] OR [General Knowledge Path]
```

### **Processing Paths**

1. **Database Path** (Existing RAG Flow):
   - SQL Generation → Database Query → Business Analysis
   - For questions requiring data analysis

2. **General Knowledge Path** (New):
   - Direct response using conversation history or general knowledge
   - For questions about names, dates, previous conversations, etc.

## 🧠 **Question Classification Logic**

### **Classification Model**
- **Model**: DeepSeek Chat Model (not coding model)
- **Reason**: Better at understanding natural language intent and context
- **Input**: Question + Conversation History
- **Output**: JSON with classification decision

### **Classification Categories**

#### **DATABASE_NEEDED** (needsDatabase: true)
Questions that require querying a database for data analysis, business insights, or specific data retrieval.

**Examples:**
- "Show me sales data"
- "Analyze customer behavior"
- "What are the top products?"
- "Compare Q1 vs Q2 performance"
- "How many customers do we have?"
- "What's our revenue trend?"
- "Find products with low inventory"

#### **GENERAL_KNOWLEDGE** (needsDatabase: false)
Questions that can be answered from conversation history or general knowledge.

**Examples:**
- "What is my name?" (from chat history)
- "What's today's date?" (general knowledge)
- "What did you tell me before?" (from chat history)
- "Can you repeat the analysis?" (from chat history)
- "What was the previous result?" (from chat history)
- "Tell me about yourself" (general knowledge)

### **Safety Mechanisms**
- **Low Confidence Default**: If confidence < 6, defaults to database path
- **Parse Error Default**: If JSON parsing fails, defaults to database path
- **Validation**: Ensures boolean values and valid confidence scores

## 📋 **Implementation Details**

### **1. Question Classification Function**
```typescript
async function classifyQuestion(question: string, chatHistory: string): Promise<QuestionClassification> {
  // Uses DeepSeek Chat Model for classification
  // Returns: { needsDatabase: boolean, reason: string, confidence: number }
}
```

### **2. Processing Paths**

#### **General Knowledge Path**
```typescript
private static async processGeneralRequest(request: RAGRequest, chatHistory: string): Promise<RAGResponse> {
  // Uses simplified prompt template
  // No database schema or data required
  // Returns simple text response
}
```

#### **Database Path**
```typescript
private static async processDatabaseRequest(request: RAGRequest, chatHistory: string): Promise<RAGResponse> {
  // Existing RAG flow with conversation history
  // Full SQL generation and business analysis
  // Returns comprehensive JSON response
}
```

### **3. Updated Main Flow**
```typescript
static async processRequest(request: RAGRequest): Promise<RAGResponse> {
  // Step 1: Load conversation history
  const chatHistory = await loadConversationHistory(request.userId);
  
  // Step 2: Classify question type
  const classification = await classifyQuestion(request.question, chatHistory);
  
  // Step 3: Route based on classification
  if (classification.needsDatabase) {
    return await this.processDatabaseRequest(request, chatHistory);
  } else {
    return await this.processGeneralRequest(request, chatHistory);
  }
}
```

## 🎯 **Prompt Templates**

### **Question Classification Template**
```typescript
const QUESTION_CLASSIFICATION_TEMPLATE = `
You are a question classifier. Determine if this question requires database analysis or can be answered from conversation history/general knowledge.

User Question: {question}
Conversation History: {chatHistory}

Classify into:
- DATABASE_NEEDED: Questions requiring database queries
- GENERAL_KNOWLEDGE: Questions answerable from history/knowledge

Return JSON: { "needsDatabase": true/false, "reason": "explanation", "confidence": 1-10 }
`;
```

### **General Knowledge Template**
```typescript
const GENERAL_KNOWLEDGE_TEMPLATE = `
You are a helpful assistant. Answer using conversation history or general knowledge.

User Question: {question}
Conversation History: {chatHistory}

Instructions:
- Use conversation history for personal info
- Use general knowledge for dates, facts
- Be conversational and helpful
- Provide clear, direct answers
`;
```

## 📊 **Response Formats**

### **Database Response** (Existing Format)
```json
{
  "insights": "Detailed analysis...",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "dataSummary": {
    "totalRecords": 150,
    "keyMetrics": {"metric1": "value1"}
  },
  "confidence": 8,
  "query": "SELECT * FROM products...",
  "databaseInfo": {
    "name": "MyDatabase",
    "type": "postgresql"
  }
}
```

### **General Knowledge Response** (Simplified Format)
```json
{
  "insights": "Based on our conversation, your name is Mr. Mohamed.",
  "recommendations": [],
  "dataSummary": {
    "totalRecords": 0,
    "keyMetrics": {}
  },
  "confidence": 8,
  "databaseInfo": {
    "name": "General Knowledge",
    "type": "conversation_history"
  }
}
```

## 🔄 **Real-World Examples**

### **Example 1: Name Recognition**
```
User: "My name is Mr. Mohamed, can you help me enhance my payment?"
Assistant: [Provides payment enhancement analysis - Database Path]

User: "What is my name?"
Assistant: "Based on our conversation, your name is Mr. Mohamed." - General Knowledge Path
```

### **Example 2: Date Information**
```
User: "What is the date today?"
Assistant: "Today is [current date]." - General Knowledge Path
```

### **Example 3: Previous Analysis Reference**
```
User: "Show me the top 5 products by sales"
Assistant: [Full database analysis with SQL query] - Database Path

User: "What did you tell me about the top products?"
Assistant: "In our previous analysis, I found that [summarizes previous results]" - General Knowledge Path
```

### **Example 4: Business Analysis**
```
User: "Analyze customer behavior patterns"
Assistant: [Full RAG analysis with database query] - Database Path
```

## 🛠 **API Endpoints**

All existing endpoints work the same way, but now with intelligent routing:

- **`POST /api/rag/analyze`**: Main endpoint with smart classification
- **`GET /api/rag/memory`**: Check memory status
- **`GET /api/rag/memory/history`**: Get conversation history
- **`DELETE /api/rag/memory/clear`**: Clear conversation memory

## 📈 **Benefits**

### **1. Performance Improvements**
- **Faster Responses**: General knowledge questions answered immediately
- **Reduced Database Load**: Only queries database when necessary
- **Lower API Costs**: Fewer LLM calls for simple questions

### **2. Better User Experience**
- **Natural Conversations**: Can reference previous information
- **Contextual Responses**: Understands conversation flow
- **Appropriate Detail Level**: Simple questions get simple answers

### **3. Resource Optimization**
- **Efficient Processing**: Routes to appropriate complexity level
- **Cost Effective**: Minimizes unnecessary database queries
- **Scalable**: Handles both simple and complex questions efficiently

## 🔍 **Testing**

Use the provided test script to verify the classification system:

```bash
node test-question-classification.js
```

This test covers:
1. General knowledge questions (names, dates)
2. Database questions (sales analysis)
3. Conversation history references
4. Classification accuracy
5. Response format validation

## 🚀 **Future Enhancements**

1. **Learning Classification**: Improve accuracy based on user feedback
2. **Custom Categories**: Add more specific classification types
3. **Confidence Thresholds**: Configurable confidence levels
4. **Performance Metrics**: Track classification accuracy and performance
5. **A/B Testing**: Compare classification vs. non-classification performance

## ⚠️ **Error Handling**

- **Classification Failures**: Default to database path for safety
- **Low Confidence**: Default to database path
- **Parse Errors**: Default to database path
- **Memory Issues**: Continue without conversation history
- **API Failures**: Graceful degradation with appropriate error messages

The Smart Question Classification System provides intelligent, efficient, and user-friendly question processing while maintaining the robustness and safety of the existing RAG system. 