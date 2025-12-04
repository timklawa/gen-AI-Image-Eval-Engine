// Evaluation service for testing LLM performance on aircraft detection
import { getAircraftById, exportOntologyJSON } from './ontologyService';
import { LLM_PROVIDERS, getModelsByProvider, getVisionModels } from './llmProviders';

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
  llmResponse?: string;
  score?: { countAccuracy: number; classAccuracy: number };
  apiDuration?: number;
  cost?: number;
  imageWidth?: number;
  imageHeight?: number;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'failed';
}

export interface EvaluationConfig {
  sampleSize: number;
  llmProvider: string;
  llmModel: string;
  systemPrompt: string;
  subset: 'train' | 'valid' | 'test';
  includeOntology: boolean;
  enableZeroShotOntologyByExample: boolean;
  structuredOutput: boolean;
  apiDelaySeconds: number;
}

export interface EvaluationResult {
  config: EvaluationConfig;
  images: EvaluationImage[];
  averageCountAccuracy: number;
  averageClassAccuracy: number;
  totalCost: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}


// Default system prompt
export const DEFAULT_SYSTEM_PROMPT = `You are an expert aircraft identification system. Analyze the provided image and identify all aircraft present. 

For each aircraft you detect, provide:
1. The exact count of aircraft in the image
2. The specific type/model of each aircraft using these class IDs and names:
   - 0: Small Civil Transport/Utility (FAA Wingspan Class 1, < 15m)
   - 1: Medium Civil Transport/Utility (FAA Wingspan Classes 2-3, 15-36m)
   - 2: Large Civil Transport/Utility (FAA Wingspan Classes 4-6, ≥ 36m)
   - 3: Military Transport/Utility/AWAC (Military non-combat operations)
   - 4: Military Bomber (Military aircraft for bombing missions)
   - 5: Military Fighter/Interceptor/Attack (Military combat aircraft)
   - 6: Military Trainer (Military training aircraft)

Respond in this exact JSON format:
{
  "count": <number>,
  "aircraft": [
    {
      "class_id": <number>,
      "confidence": <number between 0 and 1>
    }
  ]
}`;

// Get enhanced system prompt with ontology if requested
export function getEnhancedSystemPrompt(basePrompt: string, includeOntology: boolean, structuredOutput: boolean): string {
  let prompt = basePrompt;
  
  if (includeOntology) {
    const ontologyJson = exportOntologyJSON();
    prompt += `\n\nAircraft Classification Ontology:\n${ontologyJson}`;
  }
  
  if (structuredOutput) {
    prompt += `\n\nIMPORTANT: You must respond with a valid JSON object in the following format:
{
  "objects": [
    {
      "class": 0,
      "className": "Large Civil Transport",
      "confidence": 0.95
    }
  ],
  "count": 1,
  "countConfidence": 0.92
}

Where:
- "objects": array of detected aircraft with class (0-6), className, and confidence (0-1)
- "count": total number of aircraft detected
- "countConfidence": confidence score (0-1) for the overall count accuracy

Class IDs:
0: Large Civil Transport
1: Medium Civil Transport
2: Military Bomber
3: Military Fighter
4: Military Trainer
5: Military Transport
6: Small Civil Transport`;
  }
  
  return prompt;
}

// Get image dimensions from image URL
export function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      // Default dimensions if we can't load the image
      resolve({ width: 1024, height: 1024 });
    };
    img.src = imageUrl;
  });
}

// Generate random sample of images from dataset
export function generateRandomSample(
  allImages: any[],
  sampleSize: number,
  subset: 'train' | 'valid' | 'test'
): EvaluationImage[] {
  const subsetImages = allImages.filter(img => img.subset === subset);
  const shuffled = [...subsetImages].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, sampleSize);
  
  return selected.map(img => {
    const objectCount = img.objectCount || 0;
    const uniqueClasses = img.classes || [];
    
    // Generate all class instances (including duplicates) for proper comparison
    // This creates an array where each class ID appears as many times as there are objects of that class
    const allClassInstances: number[] = [];
    if (objectCount > 0 && uniqueClasses.length > 0) {
      if (uniqueClasses.length === 1) {
        // If only one class, all objects are of that class
        for (let i = 0; i < objectCount; i++) {
          allClassInstances.push(uniqueClasses[0]);
        }
      } else {
        // If multiple classes, distribute objects across them
        // For now, we'll assume equal distribution with remainder going to first class
        const baseCount = Math.floor(objectCount / uniqueClasses.length);
        const remainder = objectCount % uniqueClasses.length;
        
        uniqueClasses.forEach((classId: number, index: number) => {
          const count = baseCount + (index < remainder ? 1 : 0);
          for (let i = 0; i < count; i++) {
            allClassInstances.push(classId);
          }
        });
      }
    }
    
    return {
      id: img.id,
      filename: img.filename,
      subset: img.subset,
      imageUrl: img.imageUrl,
      actualObjects: objectCount,
      actualClasses: allClassInstances,
      actualClassNames: allClassInstances.map((classId: number) => {
        const aircraft = getAircraftById(classId);
        return aircraft ? aircraft.name : `Unknown (${classId})`;
      }),
      status: 'pending' as const
    };
  });
}

// Parse LLM response to extract count, classes, and confidence scores
export function parseLLMResponse(response: string): { 
  count: number; 
  classes: number[]; 
  countConfidence?: number; 
  classConfidences?: number[] 
} {
  console.log('=== PARSING LLM RESPONSE ===');
  console.log('Raw response:', response);
  
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    console.log('Cleaned response:', cleanResponse);
    
    // Try to find JSON in the response using regex if direct parsing fails
    let jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
      console.log('Extracted JSON:', cleanResponse);
    }
    
    // Try to parse as JSON first
    const parsed = JSON.parse(cleanResponse);
    console.log('Parsed JSON:', parsed);
    console.log('Count value:', parsed.count, 'Type:', typeof parsed.count);
    console.log('Objects array:', parsed.objects, 'Type:', typeof parsed.objects);
    
    // Handle new format with objects array
    if (parsed.count !== undefined && Array.isArray(parsed.objects)) {
      const classes = parsed.objects.map((obj: any) => obj.class).filter((id: any) => typeof id === 'number' && id >= 0 && id <= 6);
      const classConfidences = parsed.objects.map((obj: any) => obj.confidence).filter((conf: any) => typeof conf === 'number' && conf >= 0 && conf <= 1);
      console.log('Extracted classes:', classes);
      console.log('Extracted class confidences:', classConfidences);
      
      const result = {
        count: Number(parsed.count), // Ensure it's a number
        classes: classes,
        countConfidence: parsed.countConfidence,
        classConfidences: classConfidences.length > 0 ? classConfidences : undefined
      };
      
      console.log('Final parsed result:', result);
      return result;
    }
    
    // Handle legacy format with aircraft array
    if (parsed.count !== undefined && Array.isArray(parsed.aircraft)) {
      const classes = parsed.aircraft.map((a: any) => a.class_id).filter((id: any) => typeof id === 'number' && id >= 0 && id <= 6);
      console.log('Extracted classes (legacy format):', classes);
      
      const result = {
        count: Number(parsed.count), // Ensure it's a number
        classes: classes,
        countConfidence: parsed.countConfidence
      };
      
      console.log('Final parsed result (legacy):', result);
      return result;
    }
    
    // Handle simple format with just count and classes array
    if (parsed.count !== undefined && Array.isArray(parsed.classes)) {
      const classes = parsed.classes.filter((id: any) => typeof id === 'number' && id >= 0 && id <= 6);
      console.log('Extracted classes (simple format):', classes);
      
      const result = {
        count: Number(parsed.count), // Ensure it's a number
        classes: classes,
        countConfidence: parsed.countConfidence
      };
      
      console.log('Final parsed result (simple):', result);
      return result;
    }
    
    console.log('No valid format found in JSON, trying fallback extraction');
    // Fallback: try to extract count and classes from any available data
    const count = parsed.count !== undefined ? Number(parsed.count) : 0;
    const classes = parsed.classes || parsed.objects?.map((obj: any) => obj.class) || parsed.aircraft?.map((a: any) => a.class_id) || [];
    const validClasses = Array.isArray(classes) ? classes.filter((id: any) => typeof id === 'number' && id >= 0 && id <= 6) : [];
    
    const result = {
      count: count,
      classes: validClasses,
      countConfidence: parsed.countConfidence
    };
    
    console.log('Fallback result:', result);
    return result;
  } catch (e) {
    console.log('JSON parsing failed, trying text extraction:', e);
    // If JSON parsing fails, try to extract numbers from text
    const countMatch = response.match(/(?:count|aircraft|planes?)[\s:]*(\d+)/i);
    const classMatches = response.match(/\b(\d{1,2})\b/g);
    
    const result = {
      count: countMatch ? parseInt(countMatch[1]) : 0,
      classes: classMatches ? classMatches.map(Number).filter(n => n >= 0 && n <= 6) : []
    };
    
    console.log('Text extraction result:', result);
    return result;
  }
  
}

// Calculate simple percentage accuracy for class identification
export function calculateClassAccuracy(actual: number[], predicted: number[]): number {
  if (actual.length === 0 && predicted.length === 0) return 1; // Both empty = 100% accurate
  if (actual.length === 0 || predicted.length === 0) return 0; // One empty, one not = 0% accurate
  
  // Sort both arrays for comparison
  const sortedActual = [...actual].sort((a, b) => a - b);
  const sortedPredicted = [...predicted].sort((a, b) => a - b);
  
  // Check if arrays are identical
  if (sortedActual.length === sortedPredicted.length && 
      sortedActual.every((val, idx) => val === sortedPredicted[idx])) {
    return 1; // 100% accurate
  }
  
  // Calculate percentage of correct matches
  let correctMatches = 0;
  const actualCounts = new Map<number, number>();
  const predictedCounts = new Map<number, number>();
  
  // Count occurrences in actual
  sortedActual.forEach(val => {
    actualCounts.set(val, (actualCounts.get(val) || 0) + 1);
  });
  
  // Count occurrences in predicted
  sortedPredicted.forEach(val => {
    predictedCounts.set(val, (predictedCounts.get(val) || 0) + 1);
  });
  
  // Count correct matches (minimum of actual and predicted counts for each class)
  const allClasses = new Set([...actual, ...predicted]);
  allClasses.forEach(classId => {
    const actualCount = actualCounts.get(classId) || 0;
    const predictedCount = predictedCounts.get(classId) || 0;
    correctMatches += Math.min(actualCount, predictedCount);
  });
  
  // Use the smaller of the two totals as the denominator for a more forgiving score
  // This way, if LLM predicts more objects than actual, it's not heavily penalized
  const minTotal = Math.min(actual.length, predicted.length);
  const maxTotal = Math.max(actual.length, predicted.length);
  
  // If they're the same length, use exact matching
  if (actual.length === predicted.length) {
    return maxTotal > 0 ? correctMatches / maxTotal : 0;
  }
  
  // If different lengths, use a weighted approach that's more forgiving
  // Give credit for correct matches, but don't heavily penalize for extra predictions
  const baseScore = correctMatches / maxTotal;
  const lengthPenalty = Math.min(actual.length, predicted.length) / Math.max(actual.length, predicted.length);
  
  return baseScore * lengthPenalty;
}

// Calculate overall score for an image with separate count and class accuracy
export function calculateImageScore(
  actualCount: number,
  actualClasses: number[],
  predictedCount: number,
  predictedClasses: number[]
): { countAccuracy: number; classAccuracy: number } {
  // Calculate count accuracy as percentage based on how close the prediction is
  let countAccuracy = 0;
  if (actualCount === 0 && predictedCount === 0) {
    countAccuracy = 1; // Both zero = 100% accurate
  } else if (actualCount === 0 || predictedCount === 0) {
    countAccuracy = 0; // One zero, one not = 0% accurate
  } else {
    // Calculate accuracy based on the ratio, penalizing larger differences
    const ratio = Math.min(actualCount, predictedCount) / Math.max(actualCount, predictedCount);
    countAccuracy = ratio;
  }
  
  const classAccuracy = calculateClassAccuracy(actualClasses, predictedClasses);
  
  return {
    countAccuracy: countAccuracy,
    classAccuracy: classAccuracy
  };
}

// Calculate API cost using provider-specific pricing
export function calculateAPICost(
  provider: string,
  model: string,
  imageWidth: number,
  imageHeight: number,
  promptTokens: number,
  responseTokens: number
): number {
  // Import the provider configuration
  const { getProviderById, getModelById } = require('./llmProviders');
  
  const providerConfig = getProviderById(provider);
  const modelConfig = getModelById(provider, model);
  
  if (!providerConfig || !modelConfig) {
    console.warn(`Provider or model not found: ${provider}/${model}. Using fallback pricing.`);
    // Fallback to GPT-4o pricing if provider/model not found
    return calculateAPICostFallback(imageWidth, imageHeight, promptTokens, responseTokens);
  }
  
  // Get pricing from model configuration
  const inputCostPer1k = modelConfig.costPer1kInput || 0.005; // Default to GPT-4o pricing
  const outputCostPer1k = modelConfig.costPer1kOutput || 0.015; // Default to GPT-4o pricing
  
  // Calculate image tokens (simplified calculation)
  // High-res images: 170 tokens per 512x512 tile
  const imageTokens = Math.ceil((imageWidth * imageHeight) / (512 * 512)) * 170;
  
  // For vision models, image tokens are typically included in input tokens
  // Some providers charge separately for images, others include them in input tokens
  // We'll use a conservative approach and include image tokens in input cost
  const totalInputTokens = promptTokens + imageTokens;
  
  // Calculate costs using provider-specific pricing
  const inputCost = (totalInputTokens / 1000) * inputCostPer1k;
  const outputCost = (responseTokens / 1000) * outputCostPer1k;
  
  return inputCost + outputCost;
}

// Fallback cost calculation for unknown providers/models
function calculateAPICostFallback(
  imageWidth: number,
  imageHeight: number,
  promptTokens: number,
  responseTokens: number
): number {
  // GPT-4o pricing as fallback
  const INPUT_COST_PER_1K_TOKENS = 0.005; // $0.005 per 1K input tokens
  const OUTPUT_COST_PER_1K_TOKENS = 0.015; // $0.015 per 1K output tokens
  
  // Calculate image tokens
  const imageTokens = Math.ceil((imageWidth * imageHeight) / (512 * 512)) * 170;
  const totalInputTokens = promptTokens + imageTokens;
  
  // Calculate costs
  const inputCost = (totalInputTokens / 1000) * INPUT_COST_PER_1K_TOKENS;
  const outputCost = (responseTokens / 1000) * OUTPUT_COST_PER_1K_TOKENS;
  
  return inputCost + outputCost;
}

// Generate evaluation report
export function generateEvaluationReport(result: EvaluationResult): string {
  const { images, averageCountAccuracy, averageClassAccuracy, totalCost, duration } = result;
  
  const report = `
# Evaluation Report

## Configuration
- **Model**: ${result.config.llmModel}
- **Sample Size**: ${result.config.sampleSize}
- **Subset**: ${result.config.subset}
- **Duration**: ${duration ? `${Math.round(duration / 1000)}s` : 'N/A'}

## Results
- **Average Count Accuracy**: ${(averageCountAccuracy * 100).toFixed(1)}%
- **Average Class Accuracy**: ${(averageClassAccuracy * 100).toFixed(1)}%
- **Total Cost**: $${totalCost.toFixed(4)}
- **Images Processed**: ${images.length}

## Image-by-Image Results
${images.map(img => `
### ${img.filename}
- **Actual**: ${img.actualObjects} objects, classes: [${img.actualClassNames.join(', ')}]
- **Predicted**: ${img.predictedObjects || 0} objects, classes: [${img.predictedClassNames?.join(', ') || 'N/A'}]
- **Count Accuracy**: ${img.score ? (img.score.countAccuracy * 100).toFixed(1) + '%' : 'N/A'}
- **Class Accuracy**: ${img.score ? (img.score.classAccuracy * 100).toFixed(1) + '%' : 'N/A'}
- **Cost**: ${img.cost ? '$' + img.cost.toFixed(4) : 'N/A'}
- **API Duration**: ${img.apiDuration ? img.apiDuration + 'ms' : 'N/A'}
- **Status**: ${img.status}
`).join('')}
`;

  return report;
}

// Export evaluation results to CSV
export function exportToCSV(result: EvaluationResult): string {
  const headers = [
    'Image ID',
    'Filename',
    'Subset',
    'Actual Objects',
    'Actual Classes',
    'Actual Class Names',
    'Predicted Objects',
    'Predicted Classes',
    'Predicted Class Names',
    'Count Accuracy',
    'Class Accuracy',
    'Count Confidence',
    'Class Confidence',
    'Cost',
    'API Duration (ms)',
    'Image Width',
    'Image Height',
    'Status',
    'LLM Response'
  ];
  
  const rows = result.images.map(img => [
    img.id,
    img.filename,
    img.subset,
    img.actualObjects,
    img.actualClasses.join(';'),
    img.actualClassNames.join(';'),
    img.predictedObjects || '',
    (img.predictedClasses || []).join(';'),
    (img.predictedClassNames || []).join(';'),
    img.score ? (img.score.countAccuracy * 100).toFixed(1) + '%' : '',
    img.score ? (img.score.classAccuracy * 100).toFixed(1) + '%' : '',
    img.predictedCountConfidence ? (img.predictedCountConfidence * 100).toFixed(1) + '%' : '',
    img.predictedClassConfidences ? img.predictedClassConfidences.map(c => (c * 100).toFixed(1) + '%').join(';') : '',
    img.cost ? '$' + img.cost.toFixed(4) : '',
    img.apiDuration || '',
    img.imageWidth || '',
    img.imageHeight || '',
    img.status,
    (img.llmResponse || '').replace(/\n/g, ' ').replace(/,/g, ';')
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  return csvContent;
}

// Parse CSV file to restore evaluation results
export function parseCSVToEvaluationData(csvContent: string): {
  images: EvaluationImage[];
  modelName?: string;
} {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Invalid CSV format: insufficient data');
  }

  // Parse header to validate format
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const requiredHeaders = [
    'Image ID', 'Filename', 'Subset', 'Actual Objects', 'Actual Classes', 'Actual Class Names',
    'Predicted Objects', 'Predicted Classes', 'Predicted Class Names', 'Count Accuracy',
    'Class Accuracy', 'Cost', 'API Duration (ms)', 'Image Width', 'Image Height', 'Status', 'LLM Response'
  ];

  // Validate required headers
  const hasRequiredHeaders = requiredHeaders.every(header => headers.includes(header));
  if (!hasRequiredHeaders) {
    throw new Error('Invalid CSV format: missing required headers');
  }

  // Check if confidence fields are available (optional)
  const hasCountConfidence = headers.includes('Count Confidence');
  const hasClassConfidence = headers.includes('Class Confidence');

  // Parse data rows
  const images: EvaluationImage[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      // Parse CSV row (handle quoted fields)
      const fields = parseCSVRow(line);
      if (fields.length < headers.length) continue;

      const getField = (headerName: string) => {
        const index = headers.indexOf(headerName);
        return index >= 0 ? fields[index] : '';
      };

    // Parse actual classes
    const actualClassesStr = getField('Actual Classes');
    const actualClasses = actualClassesStr ? actualClassesStr.split(';').map(c => parseInt(c.trim())).filter(c => !isNaN(c)) : [];
    
    // Parse predicted classes
    const predictedClassesStr = getField('Predicted Classes');
    const predictedClasses = predictedClassesStr ? predictedClassesStr.split(';').map(c => parseInt(c.trim())).filter(c => !isNaN(c)) : [];

    // Recalculate accuracy instead of using stored values to ensure consistency
    const actualCount = parseInt(getField('Actual Objects')) || 0;
    const predictedCount = parseInt(getField('Predicted Objects')) || 0;
    
    // Recalculate scores using the same logic as live evaluation
    const scores = calculateImageScore(actualCount, actualClasses, predictedCount, predictedClasses);

    // Parse cost
    const costStr = getField('Cost').replace('$', '');
    const cost = costStr ? parseFloat(costStr) : 0;

    // Extract base name from filename (remove only the final .jpg extension)
    const imageId = getField('Image ID');
    // Remove only the final .jpg extension, keep the rest of the filename
    const baseName = imageId.replace(/\.jpg$/i, '');

    // Parse confidence values (optional fields)
    let countConfidence: number | undefined;
    let classConfidences: number[] | undefined;

    if (hasCountConfidence) {
      const countConfidenceStr = getField('Count Confidence');
      countConfidence = countConfidenceStr ? parseFloat(countConfidenceStr.replace('%', '')) / 100 : undefined;
    }

    if (hasClassConfidence) {
      const classConfidencesStr = getField('Class Confidence');
      classConfidences = classConfidencesStr ? classConfidencesStr.split(';').map(c => parseFloat(c.replace('%', '')) / 100).filter(c => !isNaN(c)) : undefined;
    }

    // If confidence fields are not available, try to extract from LLM Response
    if (!hasCountConfidence || !hasClassConfidence) {
      const llmResponse = getField('LLM Response');
      if (llmResponse) {
        try {
          // Clean the LLM response - remove markdown code blocks and fix JSON syntax
          let cleanedResponse = llmResponse.trim();
          
          // Remove markdown code blocks
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          // Fix common JSON syntax issues - step by step approach
          cleanedResponse = cleanedResponse
            .replace(/;/g, ',')  // Replace semicolons with commas
            .replace(/(\w+):/g, '"$1":');  // Add quotes around property names
          
          // Fix string values - handle multi-word strings like "Large Civil Transport"
          cleanedResponse = cleanedResponse.replace(/:\s*([A-Za-z][A-Za-z\s]*[A-Za-z])([,}])/g, ': "$1"$2');
          
          // Keep numbers as numbers
          cleanedResponse = cleanedResponse.replace(/:\s*(\d+\.?\d*)([,}])/g, ': $1$2');
          
          console.log('Cleaned LLM Response:', cleanedResponse);
          
          const parsed = JSON.parse(cleanedResponse);
          console.log('Parsed LLM Response:', parsed);
          
          if (!hasCountConfidence && parsed.countConfidence !== undefined) {
            countConfidence = parsed.countConfidence;
            console.log('Extracted countConfidence:', countConfidence);
          }
          if (!hasClassConfidence && parsed.objects && Array.isArray(parsed.objects)) {
            // Extract individual object confidences from the objects array
            classConfidences = parsed.objects.map((obj: any) => obj.confidence).filter((conf: any) => typeof conf === 'number');
            console.log('Extracted classConfidences:', classConfidences);
          }
        } catch (error) {
          // If JSON parsing fails, confidence fields remain undefined
          console.warn('Could not parse confidence from LLM response:', error);
          console.log('LLM Response content:', llmResponse);
        }
      }
    }

    // Debug logging for confidence values
    console.log('Final confidence values:', {
      countConfidence,
      classConfidences,
      hasCountConfidence,
      hasClassConfidence
    });

    // Create image object
    const image: EvaluationImage = {
      id: baseName,
      filename: getField('Filename'),
      subset: getField('Subset') as 'train' | 'test' | 'val',
      imageUrl: `http://localhost:3001/dataset/${getField('Subset')}/images/${getField('Filename')}`, // Use full URL
      actualObjects: actualCount,
      actualClasses,
      actualClassNames: getField('Actual Class Names').split(';').filter(n => n.trim()),
      predictedObjects: predictedCount,
      predictedClasses,
      predictedClassNames: getField('Predicted Class Names').split(';').filter(n => n.trim()),
      predictedCountConfidence: countConfidence,
      predictedClassConfidences: classConfidences,
      score: {
        countAccuracy: scores.countAccuracy,
        classAccuracy: scores.classAccuracy
      },
      cost,
      apiDuration: parseInt(getField('API Duration (ms)')) || 0,
      imageWidth: parseInt(getField('Image Width')) || undefined,
      imageHeight: parseInt(getField('Image Height')) || undefined,
      status: getField('Status') as 'pending' | 'processing' | 'completed' | 'error',
      llmResponse: getField('LLM Response') || ''
    };

    // Debug logging for image URL
    console.log('CSV parsed image:', {
      id: image.id,
      subset: image.subset,
      imageUrl: image.imageUrl,
      filename: image.filename,
      originalImageId: imageId,
      baseName: baseName
    });

      images.push(image);
    } catch (error) {
      console.warn(`Error parsing CSV row ${i}:`, error);
      // Skip this row and continue with the next one
      continue;
    }
  }

  return { images };
}

// Helper function to parse CSV row with quoted fields
function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  fields.push(current.trim());
  
  return fields;
}
