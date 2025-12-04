import { LLMProvider, LLMModel } from '../types';
import llmConfig from '../config/llmProviders.json';

// Convert JSON config to our interface format
export const LLM_PROVIDERS: LLMProvider[] = llmConfig.providers.map(provider => ({
  id: provider.id,
  name: provider.name,
  baseUrl: provider.baseUrl,
  apiKeyEnv: provider.apiKeyEnv,
  models: provider.models.map(model => ({
    id: model.id,
    name: model.name,
    provider: provider.id,
    supportsVision: model.supportsVision,
    maxTokens: model.maxTokens,
    costPer1kTokens: model.costPer1kInput, // Legacy field for backward compatibility
    costPer1kInput: model.costPer1kInput,
    costPer1kOutput: model.costPer1kOutput
  }))
}));

// Get models by provider
export function getModelsByProvider(): Record<string, LLMModel[]> {
  const result: Record<string, LLMModel[]> = {};
  LLM_PROVIDERS.forEach(provider => {
    result[provider.id] = provider.models;
  });
  return result;
}

// Get all vision-capable models
export function getVisionModels(): LLMModel[] {
  return LLM_PROVIDERS
    .flatMap(provider => provider.models)
    .filter(model => model.supportsVision);
}

// Get provider by ID
export function getProviderById(providerId: string): LLMProvider | undefined {
  return LLM_PROVIDERS.find(provider => provider.id === providerId);
}

// Get model by ID and provider
export function getModelById(providerId: string, modelId: string): LLMModel | undefined {
  const provider = getProviderById(providerId);
  return provider?.models.find(model => model.id === modelId);
}

// Get API key from environment
export function getApiKey(providerId: string): string | undefined {
  const provider = getProviderById(providerId);
  if (!provider) return undefined;
  
  return process.env[provider.apiKeyEnv] || localStorage.getItem(provider.apiKeyEnv.replace('REACT_APP_', '')) || undefined;
}