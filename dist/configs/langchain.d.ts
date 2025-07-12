declare function formatSQLPrompt(params: {
    schema: string;
    question: string;
    databaseType: string;
    chatHistory?: string;
}): string;
declare function formatQuestionClassificationPrompt(params: {
    question: string;
    chatHistory?: string;
}): string;
declare function formatGeneralKnowledgePrompt(params: {
    question: string;
    chatHistory?: string;
}): string;
declare function formatBusinessAnalysisPrompt(params: {
    question: string;
    data: string;
    context: string;
    chatHistory?: string;
}): string;
declare function formatSchemaAnalysisPrompt(params: {
    schema: string;
}): string;
export declare const PROMPT_TEMPLATES: {
    formatSQLPrompt: typeof formatSQLPrompt;
    formatBusinessAnalysisPrompt: typeof formatBusinessAnalysisPrompt;
    formatSchemaAnalysisPrompt: typeof formatSchemaAnalysisPrompt;
    formatQuestionClassificationPrompt: typeof formatQuestionClassificationPrompt;
    formatGeneralKnowledgePrompt: typeof formatGeneralKnowledgePrompt;
};
export declare const getEmbeddings: (texts: string[]) => Promise<number[][]>;
interface MinimalLLM {
    call(inputs: {
        prompt: string;
    }): Promise<{
        text: string;
    }>;
    predict?(prompt: string): Promise<string>;
    predictMessages?(messages: any[]): Promise<any>;
}
declare class DeepSeekLLM implements MinimalLLM {
    model: string;
    constructor(model: string);
    call(inputs: {
        prompt: string;
    }): Promise<{
        text: string;
    }>;
    predict(prompt: string): Promise<string>;
    predictMessages(messages: any[]): Promise<any>;
}
export declare const deepSeekCodingLLM: DeepSeekLLM;
export declare const deepSeekChatLLM: DeepSeekLLM;
export declare const executeSQLGeneration: (params: {
    schema: string;
    question: string;
    databaseType: string;
    chatHistory?: string;
}) => Promise<string>;
export declare const executeBusinessAnalysis: (params: {
    question: string;
    data: string;
    context: string;
    chatHistory?: string;
}) => Promise<string>;
export declare const executeSchemaAnalysis: (params: {
    schema: string;
}) => Promise<string>;
export declare const executeQuestionClassification: (params: {
    question: string;
    chatHistory?: string;
}) => Promise<string>;
export declare const executeGeneralKnowledge: (params: {
    question: string;
    chatHistory?: string;
}) => Promise<string>;
export {};
//# sourceMappingURL=langchain.d.ts.map