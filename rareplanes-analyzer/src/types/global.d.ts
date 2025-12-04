declare module '*.json' {
  const value: any;
  export default value;
}

declare module '../config/evalConfig.json' {
  interface AircraftClass {
    name: string;
  }

  interface StructuredOutputConfig {
    enabled: boolean;
    format: string;
    requiredFields: string[];
    example: string;
  }

  interface UIConfig {
    defaultSampleSize: number;
    maxSampleSize: number;
    showCostEstimates: boolean;
    showProgressDetails: boolean;
    enableRealTimeUpdates: boolean;
  }

  interface EvalConfig {
    defaultSystemPrompt: string;
    defaultOntology: { [key: string]: AircraftClass };
    defaultStructuredOutput: StructuredOutputConfig;
    ui: UIConfig;
  }

  const evalConfig: EvalConfig;
  export default evalConfig;
}


