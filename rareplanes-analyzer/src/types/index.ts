export interface YOLOAnnotation {
  classId: number;
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

export interface ImageData {
  id: string;
  filename: string;
  imagePath: string;
  imageUrl: string;
  labelPath: string;
  annotations: YOLOAnnotation[];
  objectCount: number;
  classes: number[];
}

export interface DatasetSubset {
  name: 'train' | 'valid' | 'test';
  displayName: string;
  imagePath: string;
  labelPath: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  models: LLMModel[];
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  supportsVision: boolean;
  maxTokens?: number;
  costPer1kTokens?: number; // Legacy field for backward compatibility
  costPer1kInput?: number;  // Input token cost per 1K tokens
  costPer1kOutput?: number; // Output token cost per 1K tokens
}

export interface OpenAISettings {
  apiKey: string;
  model: string;
}

export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
}

export interface OpenAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EvaluationImage {
  id: string;
  filename: string;
  subset: string;
  imageUrl: string;
  actualObjects: number;
  actualClasses: number[];
  actualClassNames: string[];
  predictedObjects?: number;
  predictedClasses?: number[];
  predictedClassNames?: string[];
  predictedCountConfidence?: number;
  predictedClassConfidences?: number[];
  score?: {
    countAccuracy: number;
    classAccuracy: number;
  };
  llmResponse?: string;
  apiDuration?: number;
  cost?: number;
  imageWidth?: number;
  imageHeight?: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

