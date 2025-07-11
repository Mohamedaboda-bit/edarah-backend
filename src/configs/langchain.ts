import axios from 'axios';
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
// Remove import { PromptTemplate } from 'langchain/dist/prompts/prompt';
// Remove import { BaseLLM } from 'langchain/llms/base';

// DeepSeek API endpoints and model names
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_CODING_MODEL = process.env.DEEPSEEK_CODING_MODEL || 'deepseek-coding';
const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// HuggingFace Inference API
const HF_API_URL = 'https://api-inference.huggingface.co/models';
const HF_EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const HF_API_KEY = process.env.HF_API_KEY;

if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY environment variable is required');
if (!HF_API_KEY) throw new Error('HF_API_KEY environment variable is required');

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

function formatBusinessAnalysisPrompt(params: { question: string; data: string; context: string; chatHistory?: string }) {
  const chatHistoryText = params.chatHistory ? `\nConversation History:\n${params.chatHistory}\n` : '';
  
  return BUSINESS_ANALYSIS_TEMPLATE
    .replace('{question}', params.question)
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

// Export formatting functions for use in ragService
export const PROMPT_TEMPLATES = {
  formatSQLPrompt,
  formatBusinessAnalysisPrompt,
  formatSchemaAnalysisPrompt,
  formatQuestionClassificationPrompt,
  formatGeneralKnowledgePrompt,
};

// DeepSeek LLM call helper
async function callDeepSeek(model: string, prompt: string): Promise<string> {
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model,
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.error) {
      const errMsg = error.response.data.error.message || 'Unknown error';
      const errCode = error.response.data.error.code || 'No code';
      console.error(`DeepSeek API error: [${errCode}] ${errMsg}`);
    } else {
        console.error('DeepSeek API error:', error.message);
    }
    throw error;
  }
}

const embeddings = new HuggingFaceInferenceEmbeddings({
  model: HF_EMBEDDING_MODEL,
  apiKey: HF_API_KEY,
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
class DeepSeekLLM implements MinimalLLM {
  model: string;
  constructor(model: string) {
    this.model = model;
  }
  async call(inputs: { prompt: string }): Promise<{ text: string }> {
    const text = await callDeepSeek(this.model, inputs.prompt);
    return { text };
  }
  async predict(prompt: string): Promise<string> {
    return (await this.call({ prompt })).text;
  }
  async predictMessages(messages: any[]): Promise<any> {
    // Not implemented for non-chat models
    throw new Error('predictMessages is not implemented for DeepSeekLLM');
  }
}

export const deepSeekCodingLLM = new DeepSeekLLM(DEEPSEEK_CODING_MODEL);
export const deepSeekChatLLM = new DeepSeekLLM(DEEPSEEK_CHAT_MODEL);

// Exported LLM/embedding functions
export const executeSQLGeneration = async (params: { schema: string; question: string; databaseType: string; chatHistory?: string }) => {
  const prompt = formatSQLPrompt(params);
  return await callDeepSeek(DEEPSEEK_CODING_MODEL, prompt);
};

export const executeBusinessAnalysis = async (params: { question: string; data: string; context: string; chatHistory?: string }) => {
  const prompt = formatBusinessAnalysisPrompt(params);
  return await callDeepSeek(DEEPSEEK_CHAT_MODEL, prompt);
};

export const executeSchemaAnalysis = async (params: { schema: string }) => {
  const prompt = formatSchemaAnalysisPrompt(params);
  return await callDeepSeek(DEEPSEEK_CHAT_MODEL, prompt);
};

export const executeQuestionClassification = async (params: { question: string; chatHistory?: string }) => {
  const prompt = formatQuestionClassificationPrompt(params);
  return await callDeepSeek(DEEPSEEK_CHAT_MODEL, prompt);
};

export const executeGeneralKnowledge = async (params: { question: string; chatHistory?: string }) => {
  const prompt = formatGeneralKnowledgePrompt(params);
  return await callDeepSeek(DEEPSEEK_CHAT_MODEL, prompt);
};