import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = "gemini" | "chatgpt" | "claude";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
}

export interface AIService {
  sendMessage(message: string, history: Message[], systemPrompt?: string): Promise<string>;
  streamMessage?(message: string, history: Message[], onChunk: (chunk: string) => void, systemPrompt?: string): Promise<void>;
}

// Gemini Service Implementation
export class GeminiService implements AIService {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(config: AIServiceConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || "gemini-2.5-flash-lite";
  }

  async sendMessage(message: string, history: Message[], systemPrompt?: string): Promise<string> {
    try {
      // Robust system instruction handling
      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        systemInstruction: systemPrompt ? systemPrompt : undefined
      });

      // Sanitize history to ensure alternating user/model roles
      // Gemini throws errors if roles don't strictly alternate
      const sanitizedHistory = this.sanitizeHistory(history);

      const geminiHistory = sanitizedHistory.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));

      // console.log("Sending Gemini request with history length:", geminiHistory.length);

      const chat = model.startChat({
        history: geminiHistory,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        },
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(`Gemini API Error: ${error.message || "Unknown error"}`);
    }
  }

  private sanitizeHistory(history: Message[]): Message[] {
    if (history.length === 0) return [];
    
    const sanitized: Message[] = [];
    let lastRole: string | null = null;
    
    for (const msg of history) {
      // Ignore empty messages
      if (!msg.content.trim()) continue;
      
      // If the role is the same as the last one, combine them or skip
      // Gemini expects: user, model, user, model...
      if (msg.role === lastRole) {
        const lastMsg = sanitized[sanitized.length - 1];
        lastMsg.content += "\n\n" + msg.content;
      } else {
        sanitized.push({ ...msg });
        lastRole = msg.role;
      }
    }
    
    // History must NOT end with a user message if we are about to send ANOTHER user message
    // gemini.startChat with history followed by sendMessage(user_msg) 
    // expects model to be the last role in history (or history to be empty)
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === "user") {
        // Technically gemini-pro handles this sessionally but startChat history 
        // usually expects model as last role if history is provided
        // Let's just pass it as is and let the SDK handle the current message as the next 'user' part
    }
    
    return sanitized;
  }

  async streamMessage(
    message: string,
    history: Message[],
    onChunk: (chunk: string) => void,
    systemPrompt?: string
  ): Promise<void> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        systemInstruction: systemPrompt ? systemPrompt : undefined
      });

      const sanitizedHistory = this.sanitizeHistory(history);
      const geminiHistory = sanitizedHistory.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: geminiHistory,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessageStream(message);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        onChunk(chunkText);
      }
    } catch (error: any) {
      console.error("Gemini Streaming Error:", error);
      throw new Error(`Gemini Streaming Error: ${error.message || "Unknown error"}`);
    }
  }
}

// ChatGPT Service (Placeholder)
export class ChatGPTService implements AIService {
  constructor(_config: AIServiceConfig) {
    // TODO: Initialize OpenAI client
    console.warn("ChatGPT service not yet implemented");
  }

  async sendMessage(_message: string, _history: Message[], _systemPrompt?: string): Promise<string> {
    throw new Error("ChatGPT integration not yet implemented. Please use Gemini for now.");
  }
}

// Claude Service (Placeholder)
export class ClaudeService implements AIService {
  constructor(_config: AIServiceConfig) {
    // TODO: Initialize Anthropic client
    console.warn("Claude service not yet implemented");
  }

  async sendMessage(_message: string, _history: Message[], _systemPrompt?: string): Promise<string> {
    throw new Error("Claude integration not yet implemented. Please use Gemini for now.");
  }
}

// Factory function to create AI service
export function createAIService(provider: AIProvider, config: AIServiceConfig): AIService {
  switch (provider) {
    case "gemini":
      return new GeminiService(config);
    case "chatgpt":
      return new ChatGPTService(config);
    case "claude":
      return new ClaudeService(config);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// API Key storage helpers using localStorage (for now)
// TODO: Migrate to Tauri secure storage
const API_KEYS_STORAGE_KEY = "inkcaliber_ai_api_keys";

export interface APIKeys {
  gemini?: string;
  chatgpt?: string;
  claude?: string;
}

export function saveAPIKey(provider: AIProvider, apiKey: string): void {
  const keys = getAPIKeys();
  keys[provider] = apiKey;
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

export function getAPIKey(provider: AIProvider): string | undefined {
  const keys = getAPIKeys();
  return keys[provider];
}

export function getAPIKeys(): APIKeys {
  const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function hasAPIKey(provider: AIProvider): boolean {
  const key = getAPIKey(provider);
  return !!key && key.trim().length > 0;
}
