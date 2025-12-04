import evalConfig from '../config/evalConfig.json';

export interface EvalConfig {
  defaultSystemPrompt: string;
  defaultOntology: { [key: string]: AircraftClass };
  defaultStructuredOutput: StructuredOutputConfig;
  ui: UIConfig;
}

export interface AircraftClass {
  name: string;
}

export interface StructuredOutputConfig {
  enabled: boolean;
  format: string;
  requiredFields: string[];
  example: string;
}

export interface UIConfig {
  defaultSampleSize: number;
  maxSampleSize: number;
  showCostEstimates: boolean;
  showProgressDetails: boolean;
  enableRealTimeUpdates: boolean;
}

// Load the evaluation configuration
export const getEvalConfig = (): EvalConfig => {
  return evalConfig as EvalConfig;
};

// Get the default system prompt
export const getDefaultSystemPrompt = (): string => {
  return evalConfig.defaultSystemPrompt;
};

// Get the default ontology
export const getDefaultOntology = (): { [key: string]: AircraftClass } => {
  return evalConfig.defaultOntology;
};

// Get the default structured output configuration
export const getDefaultStructuredOutput = (): StructuredOutputConfig => {
  return evalConfig.defaultStructuredOutput;
};

// Get UI configuration
export const getUIConfig = (): UIConfig => {
  return evalConfig.ui;
};

// Format ontology for display in JSON format
export const formatOntologyForDisplay = (): string => {
  return JSON.stringify(evalConfig.defaultOntology, null, 2);
};

// Validate structured output configuration
export const validateStructuredOutput = (config: StructuredOutputConfig): boolean => {
  if (!config.enabled) return true;
  
  // Check if required fields are present and format is JSON
  return config.requiredFields.length > 0 && config.format === 'json';
};
