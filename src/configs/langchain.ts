import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';

// Initialize LangChain models with lazy initialization
let llm: ChatOpenAI | null = null;
let llmCreative: ChatOpenAI | null = null;
let llmBalanced: ChatOpenAI | null = null;
let embeddings: OpenAIEmbeddings | null = null;

// Lazy initialization functions
const getLLM = () => {
  if (!llm) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    llm = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }
  return llm;
};

const getLLMCreative = () => {
  if (!llmCreative) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    llmCreative = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.8,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }
  return llmCreative;
};

const getLLMBalanced = () => {
  if (!llmBalanced) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    llmBalanced = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.5,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }
  return llmBalanced;
};

const getEmbeddings = () => {
  if (!embeddings) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
  }
  return embeddings;
};

// Export the getter functions
export { getLLM, getLLMCreative, getLLMBalanced, getEmbeddings };

// Prompt templates using LangChain
export const PROMPT_TEMPLATES = {
  SQL_GENERATION: PromptTemplate.fromTemplate(`
You are a SQL expert. Generate a SQL query to answer the user's question.

Database Schema:
{schema}

User Question: {question}

Requirements:
- Use only the tables and columns provided in the schema
- Return a valid SQL query that answers the question
- If the question is about analysis, include aggregations and grouping
- For business insights, focus on sales, products, customers, and reviews
- Return ONLY the SQL query, no explanations
- Use appropriate SQL syntax for {databaseType}

SQL Query:`),

  BUSINESS_ANALYSIS: PromptTemplate.fromTemplate(`
You are a business analyst and marketing expert. Analyze the provided data and answer the user's question with actionable insights.

User Question: {question}

Data Analysis:
{data}

Additional Context: {context}

Please provide:
1. Key insights from the data
2. Specific marketing recommendations
3. Summary of key metrics
4. Confidence level in your analysis (1-10)

Format your response as JSON with the following structure:
{{
  "insights": "Detailed analysis of the data...",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "dataSummary": {{
    "totalRecords": number,
    "keyMetrics": {{"metric1": value1, "metric2": value2}}
  }},
  "confidence": number
}}`),

  SCHEMA_ANALYSIS: PromptTemplate.fromTemplate(`
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
}}`)
};

// Helper functions to execute chains
export const executeSQLGeneration = async (params: { schema: string; question: string; databaseType: string }) => {
  const prompt = await PROMPT_TEMPLATES.SQL_GENERATION.format(params);
  const response = await getLLM().invoke(prompt);
  return response.content as string;
};

export const executeBusinessAnalysis = async (params: { question: string; data: string; context: string }) => {
  const prompt = await PROMPT_TEMPLATES.BUSINESS_ANALYSIS.format(params);
  const response = await getLLMCreative().invoke(prompt);
  return response.content as string;
};

export const executeSchemaAnalysis = async (params: { schema: string }) => {
  const prompt = await PROMPT_TEMPLATES.SCHEMA_ANALYSIS.format(params);
  const response = await getLLMBalanced().invoke(prompt);
  return response.content as string;
}; 