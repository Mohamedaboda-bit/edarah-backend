import axios from 'axios';
import { OpenAIEmbeddings } from '@langchain/openai';
// Remove import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
// Remove import { PromptTemplate } from 'langchain/dist/prompts/prompt';
// Remove import { BaseLLM } from 'langchain/llms/base';

// OpenAI API endpoints and model names
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_QUERY_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4.1-nano';
const OPENAI_ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4.1-nano';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Remove DeepSeek API endpoints and model names
// const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
// const DEEPSEEK_CODING_MODEL = process.env.DEEPSEEK_CODING_MODEL || 'deepseek-coding';
// const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat';
// const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Remove HuggingFace Inference API
// const HF_API_URL = 'https://api-inference.huggingface.co/models';
// const HF_EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
// const HF_API_KEY = process.env.HF_API_KEY;

if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY environment variable is required');
// Remove if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY environment variable is required');
// Remove if (!HF_API_KEY) throw new Error('HF_API_KEY environment variable is required');

// SQL Generation prompt as a plain string
const SQL_GENERATION_TEMPLATE = `
You are a SQL expert. Generate a SQL query to answer the user's question.

Database Schema:
{schema}

User Question: {question}

{chatHistory}

Requirements:
- Use only the tables and columns provided in the schema
- Return a valid SQL query that answers the question
- If the question is about analysis, include aggregations and grouping
- For business insights, focus on sales, products, customers, and reviews
- Consider the conversation history to understand context and previous questions
- Return ONLY the SQL query, no explanations
- Use appropriate SQL syntax for {databaseType}
- ONLY generate SELECT queries for data retrieval, NEVER INSERT, UPDATE, or DELETE operations
- IMPORTANT: For MySQL with ONLY_FULL_GROUP_BY mode, ALL non-aggregated columns in SELECT must be included in GROUP BY clause
- When using GROUP BY, only include columns that are functionally dependent on the GROUP BY columns or use aggregate functions (SUM, COUNT, AVG, etc.)

SQL Query:`;

function formatSQLPrompt(params: { schema: string; question: string; databaseType: string; chatHistory?: string }) {
  const chatHistoryText = params.chatHistory ? `\nConversation History:\n${params.chatHistory}\n` : '';
  
  return SQL_GENERATION_TEMPLATE
    .replace('{schema}', params.schema)
    .replace('{question}', params.question)
    .replace('{databaseType}', params.databaseType)
    .replace('{chatHistory}', chatHistoryText);
}

// Question Classification prompt
const QUESTION_CLASSIFICATION_TEMPLATE = `
You are a question classifier. Your job is to decide if the user's question REQUIRES querying a database (for business/data analysis) or can be answered from conversation history or general knowledge (like greetings, date, time, or previous chat info).

User Question: {question}

Conversation History: {chatHistory}

Classify the question into one of these categories:

DATABASE_NEEDED (answer: "yes"): Questions that require querying a database for data analysis, business insights, or specific data retrieval.
Examples:
- "Show me sales data"
- "Analyze customer behavior"
- "What are the top products?"
- "Compare Q1 vs Q2 performance"
- "How many customers do we have?"
- "What's our revenue trend?"
- "Find products with low inventory"
- "What is the average order value this month?"
- "Give me a report on last week's transactions"

GENERAL_KNOWLEDGE (answer: "no"): Questions that can be answered from conversation history or general knowledge, including:
- Greetings ("hi", "hello", "how are you?")
- Date/time ("what is today?", "what's the date?", "what time is it?")
- User info ("what is my name?", "what did I say before?", "can you repeat the last answer?")
- General facts ("who are you?", "tell me about yourself")
Examples:
- "What is my name?" (from chat history)
- "What's today's date?" (general knowledge)
- "What day is it?" (general knowledge)
- "What time is it?" (general knowledge)
- "Hi, how are you?" (greeting)
- "Hello" (greeting)
- "What did you tell me before?" (from chat history)
- "Can you repeat the analysis?" (from chat history)
- "What was the previous result?" (from chat history)
- "Tell me about yourself" (general knowledge)

IMPORTANT:
- If the question is about the current date, time, greetings, or general info, answer "no" (do NOT use the database).
- If you are NOT SURE, answer "maybe" (and default to database for safety).
- Be strict: Only answer "yes", "no", or "maybe" for needsDatabase.

Return ONLY a JSON response in this format:
{
  "needsDatabase": "yes" | "no" | "maybe",
  "reason": "brief explanation",
  "confidence": 1-10
}
`;

function formatQuestionClassificationPrompt(params: { question: string; chatHistory?: string }) {
  const chatHistoryText = params.chatHistory ? params.chatHistory : 'No conversation history available';
  
  return QUESTION_CLASSIFICATION_TEMPLATE
    .replace('{question}', params.question)
    .replace('{chatHistory}', chatHistoryText);
}

// General Knowledge Response prompt
const GENERAL_KNOWLEDGE_TEMPLATE = `
You are a helpful assistant. Answer the user's question using conversation history or general knowledge.

User Question: {question}

Conversation History: {chatHistory}

Instructions:
- If the question asks about information shared in conversation history, use that information
- If it's general knowledge (dates, facts, etc.), provide accurate information
- If it references previous analysis, summarize what was discussed
- Be conversational and helpful
- Do not mention database queries or technical details
- Provide clear, direct answers

Answer the question based on the available information.`;

function formatGeneralKnowledgePrompt(params: { question: string; chatHistory?: string }) {
  const chatHistoryText = params.chatHistory ? params.chatHistory : 'No conversation history available';
  
  return GENERAL_KNOWLEDGE_TEMPLATE
    .replace('{question}', params.question)
    .replace('{chatHistory}', chatHistoryText);
}

const BUSINESS_ANALYSIS_TEMPLATE = `
You are a business analyst and marketing expert. Analyze the provided data and answer the user's question with actionable insights.

User Question: {question}

{chatHistory}

Data Analysis:
{data}

Additional Context: {context}

Please provide:
1. Key insights from the data
2. Specific marketing recommendations
3. Summary of key metrics
4. Confidence level in your analysis (1-10)

IMPORTANT: 
- Focus on business insights and actionable recommendations
- Consider the conversation history to provide contextual and relevant insights
- Build upon previous analysis and recommendations when appropriate
- Do not mention database details, technical implementation, or query specifics
- Provide insights that would be valuable for business decision making
- Keep recommendations practical and implementable

Format your response as clean JSON (no markdown code blocks) with the following structure:
{{
  "insights": "Detailed analysis of the data...",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "dataSummary": {{
    "totalRecords": number,
    "keyMetrics": {{"metric1": value1, "metric2": value2}}
  }},
  "confidence": number
}}`;

const DASHBOARD_ANALYSIS_TEMPLATE = `
You are a dashboard analytics expert. Analyze the provided e-commerce data and return structured analytics for a business dashboard.

Data Analysis:
{data}

Additional Context: {context}

{chatHistory}

IMPORTANT: 
- Return ONLY structured JSON data, no explanations or markdown
- Focus on business metrics and actionable insights
- Calculate percentages and metrics accurately
- Identify top performers and problem areas
- Provide chart-ready data structures

Return a JSON object with this EXACT structure:
{{
  "categories": [
    {{
      "name": "category_name",
      "totalProducts": number,
      "totalRevenue": number,
      "totalProfit": number,
      "percentage": number,
      "avgRating": number,
      "topProduct": {{
        "name": "product_name",
        "revenue": number,
        "profit": number,
        "sales": number
      }}
    }}
  ],
  "suppliers": [
    {{
      "name": "supplier_name",
      "totalProducts": number,
      "totalRevenue": number,
      "totalProfit": number,
      "percentage": number,
      "avgRating": number,
      "topProduct": {{
        "name": "product_name",
        "revenue": number,
        "profit": number,
        "sales": number
      }}
    }}
  ],
  "topProducts": {{
    "lowSales": [
      {{
        "name": "product_name",
        "sales": number,
        "revenue": number,
        "profit": number,
        "stock": number,
        "category": "category_name",
        "supplier": "supplier_name"
      }}
    ],
    "deadStock": [
      {{
        "name": "product_name",
        "sales": number,
        "stock": number,
        "revenue": number,
        "profit": number,
        "category": "category_name",
        "supplier": "supplier_name"
      }}
    ],
    "expired": [
      {{
        "name": "product_name",
        "lastRestocked": "date",
        "stock": number,
        "sales": number,
        "category": "category_name",
        "supplier": "supplier_name"
      }}
    ],
    "loss": [
      {{
        "name": "product_name",
        "profit": number,
        "revenue": number,
        "sales": number,
        "category": "category_name",
        "supplier": "supplier_name"
      }}
    ],
    "bestPerformers": [
      {{
        "name": "product_name",
        "revenue": number,
        "profit": number,
        "sales": number,
        "rating": number,
        "category": "category_name",
        "supplier": "supplier_name"
      }}
    ],
    "worstPerformers": [
      {{
        "name": "product_name",
        "revenue": number,
        "profit": number,
        "sales": number,
        "rating": number,
        "category": "category_name",
        "supplier": "supplier_name"
      }}
    ]
  },
  "chartData": {{
    "categoryRevenue": [
      {{
        "category": "category_name",
        "revenue": number,
        "percentage": number
      }}
    ],
    "categoryProfit": [
      {{
        "category": "category_name",
        "profit": number,
        "percentage": number
      }}
    ],
    "supplierPerformance": [
      {{
        "supplier": "supplier_name",
        "revenue": number,
        "profit": number,
        "productCount": number
      }}
    ],
    "monthlyTrends": [
      {{
        "month": "YYYY-MM",
        "revenue": number,
        "profit": number,
        "sales": number
      }}
    ]
  }},
  "overallPerformance": {{
    "totalRevenue": number,
    "totalProfit": number,
    "avgProfit": number,
    "avgProfitMargin": number,
    "totalProducts": number,
    "totalSales": number,
    "avgRating": number,
    "profitChange": number,
    "revenueChange": number
  }},
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
  ]
}}`;

function formatBusinessAnalysisPrompt(params: { question: string; data: string; context: string; chatHistory?: string }) {
  const chatHistoryText = params.chatHistory ? `\nConversation History:\n${params.chatHistory}\n` : '';
  
  return BUSINESS_ANALYSIS_TEMPLATE
    .replace('{question}', params.question)
    .replace('{data}', params.data)
    .replace('{context}', params.context)
    .replace('{chatHistory}', chatHistoryText);
}

function formatDashboardAnalysisPrompt(params: { data: string; context: string; chatHistory?: string }) {
  const chatHistoryText = params.chatHistory ? `\nConversation History:\n${params.chatHistory}\n` : '';
  
  return DASHBOARD_ANALYSIS_TEMPLATE
    .replace('{data}', params.data)
    .replace('{context}', params.context)
    .replace('{chatHistory}', chatHistoryText);
}

const SCHEMA_ANALYSIS_TEMPLATE = `
You are a database expert. Analyze the provided database schema and suggest the type of business this database represents.

Database Schema:
{schema}

Please identify:
1. Business type (e-commerce, restaurant, service, etc.)
2. Key business entities
3. Main business processes
4. Potential analysis opportunities

Format your response as JSON:
{{
  "businessType": "string",
  "entities": ["entity1", "entity2"],
  "processes": ["process1", "process2"],
  "analysisOpportunities": ["opportunity1", "opportunity2"]
}}`;

function formatSchemaAnalysisPrompt(params: { schema: string }) {
  return SCHEMA_ANALYSIS_TEMPLATE.replace('{schema}', params.schema);
}

const AI_TABLE_TEMPLATE = `You are an expert data analyst.

You MUST return ONLY a JSON array of objects, nothing else.
Do NOT return summaries, categories, explanations, or any other structure.
Do NOT include keys like 'categories', 'suppliers', 'topProducts', 'chartData', or 'overallPerformance'.

Each object in the array must have these fields:
- Name (string)
- Category (string)
- Price (string, e.g., '55 L.E.')
- Sales (string: 'Low', 'Mid', or 'High')
- Expiry date (string, e.g., 'in 4 days')
- Avg. profit (string, e.g., '+0.3%')
- Warning (string: 'Low', 'Mid', or 'High')

Sample output:
[
  {"Name": "Blueberry", "Category": "Fruit", "Price": "55 L.E.", "Sales": "Low", "Expiry date": "in 4 days", "Avg. profit": "+0.3%", "Warning": "Low"},
  {"Name": "Blueberry", "Category": "Fruit", "Price": "55 L.E.", "Sales": "Low", "Expiry date": "in 4 days", "Avg. profit": "+0.3%", "Warning": "High"}
]

If you return anything other than the array above, the result will be discarded.

Repeat: ONLY return the array, nothing else.

Data:
{data}
`;

export function formatAITablePrompt(params: { data: string }) {
  return AI_TABLE_TEMPLATE.replace('{data}', params.data);
}

const MARKETING_PLAN_TEMPLATE = `You are a world-class marketing strategist. Based on the following business data and previous analysis context, generate a comprehensive marketing plan.

PREVIOUS ANALYSIS CONTEXT:
{contextFromQA}

BUSINESS DATA:
{dataContext}

Generate a MASSIVE, comprehensive marketing plan that specifically addresses the insights from the previous questions and answers, while incorporating the business data provided.

INSTRUCTIONS:
- Analyze the Q&A context to understand the business situation, challenges, opportunities, and current performance
- Create a marketing plan that directly addresses the specific insights, problems, and opportunities identified in the Q&A context
- Use the business data to support your recommendations with concrete metrics and evidence
- Make every section highly detailed and actionable
- Structure the plan based on what's most relevant to the Q&A insights (you decide the sections and focus areas)
- Include specific implementation steps, timelines, budgets, and success metrics
- Reference the Q&A findings throughout to show how each recommendation addresses specific business needs
- Use rich markdown formatting with headers, subheaders, bullet points, numbered lists, and tables
- Include visual elements like ASCII charts where helpful
- Make recommendations specific to this business based on the Q&A analysis
- Provide step-by-step implementation guides for complex strategies
- Include troubleshooting guides and common pitfalls to avoid
- Add case studies and examples where relevant
- Ensure every recommendation has clear success metrics and KPIs

IMPORTANT: 
- Let the Q&A context guide what sections and strategies to focus on most heavily
- Don't follow a rigid template - adapt the plan structure to what this specific business needs based on the analysis
- Be extremely detailed and comprehensive - this should be suitable for presentation to senior management and immediate execution
- Every section should reference and build upon the Q&A insights to create a highly targeted strategy
- Include specific data references and metrics from the provided business data throughout

Generate the most detailed and actionable marketing plan possible, covering every aspect that's relevant to this business based on the Q&A analysis.`;

function formatMarketingPlanPrompt(params: { contextFromQA: string; dataContext: string }) {
  return MARKETING_PLAN_TEMPLATE
    .replace('{contextFromQA}', params.contextFromQA)
    .replace('{dataContext}', params.dataContext);
}

// Export formatting functions for use in ragService
export const PROMPT_TEMPLATES = {
  formatSQLPrompt,
  formatBusinessAnalysisPrompt,
  formatSchemaAnalysisPrompt,
  formatQuestionClassificationPrompt,
  formatGeneralKnowledgePrompt,
  formatMarketingPlanPrompt,
};

// OpenAI LLM call helper
async function callOpenAI(model: string, prompt: string): Promise<string> {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model,
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.error) {
      const errMsg = error.response.data.error.message || 'Unknown error';
      const errCode = error.response.data.error.code || 'No code';
      console.error(`OpenAI API error: [${errCode}] ${errMsg}`);
    } else {
        console.error('OpenAI API error:', error.message);
    }
    throw error;
  }
}

const embeddings = new OpenAIEmbeddings({
  modelName: OPENAI_EMBEDDING_MODEL,
  openAIApiKey: OPENAI_API_KEY,
});

export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  return await embeddings.embedDocuments(texts);
};

// Define the minimal interface expected by LLMChain
interface MinimalLLM {
  call(inputs: { prompt: string }): Promise<{ text: string }>;
  predict?(prompt: string): Promise<string>;
  predictMessages?(messages: any[]): Promise<any>;
}

// Your custom LLM
export class OpenAILLM implements MinimalLLM {
  model: string;
  constructor(model: string) {
    this.model = model;
  }
  async call(inputs: { prompt: string }): Promise<{ text: string }> {
    const text = await callOpenAI(this.model, inputs.prompt);
    return { text };
  }
  async predict(prompt: string): Promise<string> {
    return (await this.call({ prompt })).text;
  }
  async predictMessages(messages: any[]): Promise<any> {
    // Not implemented for non-chat models
    throw new Error('predictMessages is not implemented for OpenAILLM');
  }
}

export const openAIQueryLLM = new OpenAILLM(OPENAI_QUERY_MODEL);
export const openAIAnalysisLLM = new OpenAILLM(OPENAI_ANALYSIS_MODEL);

// Exported LLM/embedding functions
export const executeSQLGeneration = async (params: { schema: string; question: string; databaseType: string; chatHistory?: string }) => {
  const prompt = formatSQLPrompt(params);
  return await callOpenAI(OPENAI_QUERY_MODEL, prompt);
};

export const executeBusinessAnalysis = async (params: { question: string; data: string; context: string; chatHistory?: string }) => {
  const prompt = formatBusinessAnalysisPrompt(params);
  return await callOpenAI(OPENAI_ANALYSIS_MODEL, prompt);
};

export const executeDashboardAnalysis = async (params: { data: string; context: string; chatHistory?: string }) => {
  const prompt = formatDashboardAnalysisPrompt(params);
  return await callOpenAI(OPENAI_ANALYSIS_MODEL, prompt);
};

export const executeSchemaAnalysis = async (params: { schema: string }) => {
  const prompt = formatSchemaAnalysisPrompt(params);
  return await callOpenAI(OPENAI_ANALYSIS_MODEL, prompt);
};

export const executeQuestionClassification = async (params: { question: string; chatHistory?: string }) => {
  const prompt = formatQuestionClassificationPrompt(params);
  return await callOpenAI(OPENAI_ANALYSIS_MODEL, prompt);
};

export const executeGeneralKnowledge = async (params: { question: string; chatHistory?: string }) => {
  const prompt = formatGeneralKnowledgePrompt(params);
  return await callOpenAI(OPENAI_ANALYSIS_MODEL, prompt);
};
