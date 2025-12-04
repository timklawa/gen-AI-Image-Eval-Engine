import { useState, useCallback, useRef } from 'react';
import { EvaluationImage, EvaluationConfig, EvaluationResult, generateRandomSample, parseLLMResponse, calculateImageScore, generateEvaluationReport, exportToCSV, getImageDimensions, calculateAPICost, getEnhancedSystemPrompt, parseCSVToEvaluationData } from '../services/evalService';
import { analyzeImageWithLLM } from '../services/llmApiService';
import { loadImageData, datasetSubsets } from '../services/datasetService';
import { LLM_PROVIDERS } from '../services/llmProviders';
import { getAllExampleImages } from '../services/ontologyImageService';

interface SelectedModel {
  id: string;
  name: string;
  provider: string;
  providerName: string;
}

interface ModelEvaluation {
  model: SelectedModel;
  images: EvaluationImage[];
  results: EvaluationResult | null;
  isRunning: boolean;
  currentImageIndex: number;
  progress: number;
  config: EvaluationConfig;
}

export const useEvaluation = () => {
  const [allImages, setAllImages] = useState<any[]>([]);
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [modelEvaluations, setModelEvaluations] = useState<Record<string, ModelEvaluation>>({});
  const [activeTab, setActiveTab] = useState<string>('config');
  const [loading, setLoading] = useState(false);
  const stopFlags = useRef<Record<string, boolean>>({});
  const [uploadedResults, setUploadedResults] = useState<Record<string, { images: EvaluationImage[]; modelName?: string }>>({});

  const loadAllImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await loadImageData(datasetSubsets[0], 1, 1000); // Load first 1000 images
      console.log('Loaded images:', response.images.length);
      // Add subset property to images
      const imagesWithSubset = response.images.map(img => ({ ...img, subset: 'train' }));
      setAllImages(imagesWithSubset);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addModel = useCallback((model: SelectedModel) => {
    setSelectedModels(prev => {
      if (prev.find(m => m.id === model.id)) return prev;
      return [...prev, model];
    });
  }, []);

  const removeModel = useCallback((modelId: string) => {
    setSelectedModels(prev => prev.filter(m => m.id !== modelId));
    setModelEvaluations(prev => {
      const newEvaluations = { ...prev };
      delete newEvaluations[modelId];
      return newEvaluations;
    });
  }, []);

  const generateSample = useCallback((config: EvaluationConfig) => {
    console.log('generateSample called with:', { allImagesLength: allImages.length, sampleSize: config.sampleSize, subset: config.subset });
    if (allImages.length === 0) {
      console.log('No images available for sampling');
      return;
    }

    const sample = generateRandomSample(allImages, config.sampleSize, config.subset);
    console.log('Generated sample:', sample.length, 'images');
    
    const newEvaluations: Record<string, ModelEvaluation> = {};
    selectedModels.forEach(model => {
      newEvaluations[model.id] = {
        model,
        images: sample,
        results: null,
        isRunning: false,
        currentImageIndex: 0,
        progress: 0,
        config
      };
    });

    setModelEvaluations(newEvaluations);
    
    // Switch to the first model tab
    if (selectedModels.length > 0) {
      console.log('Switching to tab:', selectedModels[0].id);
      setActiveTab(selectedModels[0].id);
    }
  }, [allImages, selectedModels]);

  const runEvaluation = useCallback(async (modelId: string, config: EvaluationConfig) => {
    const evaluation = modelEvaluations[modelId];
    if (!evaluation) return;

    stopFlags.current[modelId] = false;
    setModelEvaluations(prev => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        isRunning: true,
        progress: 0,
        currentImageIndex: 0
      }
    }));

    const results: EvaluationImage[] = [...evaluation.images];
    let totalCost = 0;
    let totalDuration = 0;

    for (let i = 0; i < evaluation.images.length; i++) {
      // Check if evaluation was stopped
      if (stopFlags.current[modelId]) {
        console.log('Evaluation stopped by user');
        break;
      }
      
      const img = evaluation.images[i];
      
      // Update status to processing
      results[i] = { ...img, status: 'processing' };
      setModelEvaluations(prev => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          images: [...results],
          currentImageIndex: i,
          progress: (i / evaluation.images.length) * 100
        }
      }));

      try {
        // Convert image to base64
        const response = await fetch(img.imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove the data:image/jpeg;base64, prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(blob);
        });

        // Get enhanced prompt with ontology and structured output
        // If zero-shot ontology by example is enabled, don't include text ontology
        const enhancedPrompt = getEnhancedSystemPrompt(
          config.systemPrompt,
          config.includeOntology && !config.enableZeroShotOntologyByExample,
          config.structuredOutput
        );

        // Get example images if zero-shot ontology by example is enabled
        const exampleImages = config.enableZeroShotOntologyByExample 
          ? getAllExampleImages() 
          : undefined;

        console.log('Enhanced prompt:', enhancedPrompt);
        console.log('Zero-shot by example enabled:', config.enableZeroShotOntologyByExample);
        console.log('Example images count:', exampleImages?.length || 0);
        console.log('API Key env var:', `REACT_APP_${evaluation.model.provider.toUpperCase()}_API_KEY`);
        console.log('API Key value:', process.env[`REACT_APP_${evaluation.model.provider.toUpperCase()}_API_KEY`] || '');
        
        const apiStartTime = Date.now();
        
        // Add retry logic for API calls
        let response_data;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            response_data = await analyzeImageWithLLM(
              {
                provider: evaluation.model.provider,
                model: evaluation.model.id,
                apiKey: process.env[`REACT_APP_${evaluation.model.provider.toUpperCase()}_API_KEY`] || ''
              },
              enhancedPrompt,
              base64,
              exampleImages
            );
            
            // If we get a valid response, break out of retry loop
            if (response_data.content && response_data.content.trim() !== '') {
              break;
            }
            
            // If response is empty but no error, it might be a rate limit
            if (retryCount < maxRetries - 1) {
              console.log(`Empty response for image ${i}, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
              retryCount++;
            } else {
              console.error(`Failed to get valid response after ${maxRetries} attempts for image ${i}`);
              break;
            }
          } catch (error) {
            console.error(`API call failed for image ${i}, attempt ${retryCount + 1}:`, error);
            if (retryCount < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
              retryCount++;
            } else {
              throw error;
            }
          }
        }
        
        console.log('API Response:', response_data);
        
        // Check for API errors
        if (response_data?.error) {
          console.error('API Error for image', i, ':', response_data.error);
        }
        
        if (!response_data?.content || response_data.content.trim() === '') {
          console.error('Empty API response for image', i, ':', {
            content: response_data?.content,
            error: response_data?.error,
            duration: response_data?.duration
          });
        }

        const apiDuration = response_data?.duration || (Date.now() - apiStartTime);

        const parsed = parseLLMResponse(response_data?.content || '');
        console.log('=== EVALUATION UPDATE ===');
        console.log('Image index:', i);
        console.log('Parsed result:', parsed);
        console.log('Predicted objects:', parsed.count);
        console.log('Predicted classes:', parsed.classes);
        
        const dimensions = await getImageDimensions(img.imageUrl);
        const cost = calculateAPICost(
          evaluation.model.provider,
          evaluation.model.id,
          dimensions.width,
          dimensions.height,
          response_data?.usage?.prompt_tokens || 0,
          response_data?.usage?.completion_tokens || 0
        );
        const score = calculateImageScore(
          img.actualObjects,
          img.actualClasses,
          parsed.count,
          parsed.classes
        );

        const updatedImg: EvaluationImage = {
          ...img,
          predictedObjects: parsed.count,
          predictedClasses: parsed.classes,
          predictedClassNames: parsed.classes.map(classId => {
            const aircraft = require('../services/ontologyService').getAircraftById(classId);
            return aircraft ? aircraft.name : `Unknown (${classId})`;
          }),
          predictedCountConfidence: parsed.countConfidence,
          predictedClassConfidences: parsed.classConfidences,
          llmResponse: response_data?.content || (response_data?.error ? `Error: ${response_data.error}` : ''),
          apiDuration: apiDuration,
          cost: cost,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
          score: score,
          status: 'completed'
        };
        
        console.log('Updated image object:', updatedImg);
        console.log('Updated predictedObjects:', updatedImg.predictedObjects);

        results[i] = updatedImg;
        totalCost += cost;
        totalDuration += apiDuration;

        console.log('Results array after update:', results);
        console.log('Results[i] after update:', results[i]);
        console.log('Results[i].predictedObjects:', results[i].predictedObjects);

        // Update progress - sync both images and results.images arrays
        setModelEvaluations(prev => {
          const currentEvaluation = prev[modelId];
          const newState = {
            ...prev,
            [modelId]: {
              ...currentEvaluation,
              images: [...results],
              results: currentEvaluation.results ? {
                ...currentEvaluation.results,
                images: [...results]
              } : null,
              currentImageIndex: i + 1,
              progress: ((i + 1) / evaluation.images.length) * 100
            }
          };
          console.log('New state after update:', newState);
          console.log('New state images:', newState[modelId].images);
          console.log('New state images[i]:', newState[modelId].images[i]);
          console.log('New state images[i].predictedObjects:', newState[modelId].images[i]?.predictedObjects);
          return newState;
        });

      } catch (error) {
        console.error(`Error processing image ${i}:`, error);
        results[i] = { ...img, status: 'error' };
        
        setModelEvaluations(prev => {
          const currentEvaluation = prev[modelId];
          return {
            ...prev,
            [modelId]: {
              ...currentEvaluation,
              images: [...results],
              results: currentEvaluation.results ? {
                ...currentEvaluation.results,
                images: [...results]
              } : null,
              currentImageIndex: i + 1,
              progress: ((i + 1) / evaluation.images.length) * 100
            }
          };
        });
      }
      
      // Add delay between API calls to prevent rate limiting
      if (i < evaluation.images.length - 1 && config.apiDelaySeconds > 0) {
        console.log(`Waiting ${config.apiDelaySeconds} seconds before next API call...`);
        await new Promise(resolve => setTimeout(resolve, config.apiDelaySeconds * 1000));
      }
    }

    // Generate final results
    const completedResults = results.filter(img => img.status === 'completed');
    const averageCountAccuracy = completedResults.reduce((sum, img) => sum + (img.score?.countAccuracy || 0), 0) / completedResults.length;
    const averageClassAccuracy = completedResults.reduce((sum, img) => sum + (img.score?.classAccuracy || 0), 0) / completedResults.length;

    const finalResults: EvaluationResult = {
      config,
      images: results,
      averageCountAccuracy,
      averageClassAccuracy,
      totalCost,
      startTime: new Date(),
      duration: totalDuration
    };

    setModelEvaluations(prev => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        results: finalResults,
        isRunning: false,
        progress: 100
      }
    }));
  }, [modelEvaluations]);

  const downloadReport = useCallback((modelId: string) => {
    const evaluation = modelEvaluations[modelId];
    if (!evaluation?.results) return;

    const report = generateEvaluationReport(evaluation.results);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-report-${evaluation.model.name}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [modelEvaluations]);

  const downloadCSV = useCallback((modelId: string) => {
    const evaluation = modelEvaluations[modelId];
    if (!evaluation?.results) return;

    const csv = exportToCSV(evaluation.results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-results-${evaluation.model.name}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [modelEvaluations]);

  const downloadAllResults = useCallback(() => {
    const completedEvaluations = Object.values(modelEvaluations).filter(evaluation => evaluation.results !== null);
    if (completedEvaluations.length === 0) return;

    // Import xlsx dynamically to avoid build issues
    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      // Add each model's results as a separate sheet
      completedEvaluations.forEach(evaluation => {
        const results = evaluation.results!;
        
        // Prepare data for the sheet
        const sheetData = [
          // Header row
          [
            'Image #',
            'Image URL',
            'Actual Objects',
            'Actual Classes',
            'Predicted Objects',
            'Predicted Classes',
            'Count Accuracy (%)',
            'Class Accuracy (%)',
            'API Time (ms)',
            'Cost ($)',
            'Status',
            'LLM Response'
          ],
          // Data rows
          ...results.images.map((img, index) => [
            index + 1,
            img.imageUrl,
            img.actualObjects,
            img.actualClasses?.join(', ') || '',
            img.predictedObjects || 0,
            img.predictedClasses?.join(', ') || '',
            img.score?.countAccuracy ? (img.score.countAccuracy * 100).toFixed(2) : '0.00',
            img.score?.classAccuracy ? (img.score.classAccuracy * 100).toFixed(2) : '0.00',
            img.apiDuration || 0,
            img.cost || 0,
            img.status || 'completed',
            img.llmResponse || ''
          ])
        ];

        // Add summary row
        sheetData.push([
          'SUMMARY',
          '',
          '',
          '',
          '',
          '',
          (results.averageCountAccuracy * 100).toFixed(2),
          (results.averageClassAccuracy * 100).toFixed(2),
          results.images.reduce((sum, img) => sum + (img.apiDuration || 0), 0),
          results.totalCost.toFixed(4),
          '',
          ''
        ]);

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Set column widths
        const columnWidths = [
          { wch: 8 },   // Image #
          { wch: 30 },  // Image URL
          { wch: 12 },  // Actual Objects
          { wch: 15 },  // Actual Classes
          { wch: 15 },  // Predicted Objects
          { wch: 15 },  // Predicted Classes
          { wch: 15 },  // Count Accuracy
          { wch: 15 },  // Class Accuracy
          { wch: 12 },  // API Time
          { wch: 10 },  // Cost
          { wch: 10 },  // Status
          { wch: 50 }   // LLM Response
        ];
        worksheet['!cols'] = columnWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, evaluation.model.name);
      });

      // Add summary sheet
      const summaryData = [
        ['Model', 'Average Count Accuracy (%)', 'Average Class Accuracy (%)', 'Total Cost ($)', 'Total API Time (ms)', 'Images Processed'],
        ...completedEvaluations.map(evaluation => [
          evaluation.model.name,
          (evaluation.results!.averageCountAccuracy * 100).toFixed(2),
          (evaluation.results!.averageClassAccuracy * 100).toFixed(2),
          evaluation.results!.totalCost.toFixed(4),
          evaluation.results!.images.reduce((sum, img) => sum + (img.apiDuration || 0), 0),
          evaluation.results!.images.length
        ])
      ];

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWorksheet['!cols'] = [
        { wch: 20 },  // Model
        { wch: 20 },  // Count Accuracy
        { wch: 20 },  // Class Accuracy
        { wch: 15 },  // Total Cost
        { wch: 15 },  // Total API Time
        { wch: 15 }   // Images Processed
      ];
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Generate and download the Excel file
      XLSX.writeFile(workbook, `evaluation-results-${new Date().toISOString().split('T')[0]}.xlsx`);
    }).catch(error => {
      console.error('Error generating Excel file:', error);
      // Fallback to CSV if Excel generation fails
      const results = completedEvaluations.map(evaluation => ({
        modelName: evaluation.model.name,
        data: exportToCSV(evaluation.results!)
      })).filter(Boolean);

      if (results.length === 0) return;

      let combinedCSV = '';
      results.forEach(result => {
        combinedCSV += `\n\n=== ${result.modelName} Results ===\n\n`;
        combinedCSV += result.data;
      });

      const blob = new Blob([combinedCSV], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-evaluation-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [modelEvaluations]);

  // Calculate estimated cost for a sample run
  const calculateEstimatedCost = useCallback((modelId: string, sampleSize: number): number => {
    const model = selectedModels.find(m => m.id === modelId);
    if (!model) return 0;

    // Get model configuration for pricing
    const provider = LLM_PROVIDERS.find(p => p.id === model.provider);
    const modelConfig = provider?.models.find(m => m.id === modelId);
    
    if (!modelConfig || !modelConfig.costPer1kInput || !modelConfig.costPer1kOutput) {
      return 0;
    }

    // Estimate tokens based on typical image analysis
    // Average system prompt: ~200 tokens
    // Average image (1024x1024): ~170 tokens (OpenAI's calculation)
    // Average response: ~100 tokens
    const estimatedPromptTokens = 200;
    const estimatedImageTokens = 170; // For 1024x1024 images
    const estimatedResponseTokens = 100;
    
    const totalInputTokens = estimatedPromptTokens + estimatedImageTokens;
    const totalOutputTokens = estimatedResponseTokens;
    
    // Calculate cost per image
    const costPerImage = 
      (totalInputTokens / 1000) * modelConfig.costPer1kInput +
      (totalOutputTokens / 1000) * modelConfig.costPer1kOutput;
    
    // Total cost for the sample
    return costPerImage * sampleSize;
  }, [selectedModels]);

  // Function to rerun a specific image evaluation
  const rerunImageEvaluation = useCallback(async (modelId: string, imageIndex: number) => {
    console.log('=== RERUN FUNCTION CALLED ===');
    console.log('Rerunning image evaluation:', { modelId, imageIndex });
    console.log('Current modelEvaluations keys:', Object.keys(modelEvaluations));
    
    const modelEvaluation = modelEvaluations[modelId];
    console.log('Model evaluation found:', !!modelEvaluation);
    console.log('Model evaluation results:', !!modelEvaluation?.results);
    
    if (!modelEvaluation || !modelEvaluation.results) {
      console.log('No model evaluation found:', { modelId, hasResults: !!modelEvaluation?.results });
      return;
    }

    const img = modelEvaluation.results.images[imageIndex];
    console.log('Image found at index:', !!img, img?.id);
    
    if (!img) {
      console.log('No image found at index:', imageIndex);
      return;
    }
    
    console.log('Starting rerun for image:', img.id);

    // Update the image status to processing immediately
    setModelEvaluations(prev => {
      const currentEvaluation = prev[modelId];
      if (!currentEvaluation || !currentEvaluation.results) return prev;

      const updatedImages = [...currentEvaluation.results.images];
      updatedImages[imageIndex] = { ...updatedImages[imageIndex], status: 'processing' as const };

      return {
        ...prev,
        [modelId]: {
          ...currentEvaluation,
          results: {
            ...currentEvaluation.results,
            images: updatedImages
          }
        }
      };
    });

    try {
      // Convert image to base64
      const response = await fetch(img.imageUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(blob);
      });

      // Get enhanced prompt
      // If zero-shot ontology by example is enabled, don't include text ontology
      const enhancedPrompt = getEnhancedSystemPrompt(
        modelEvaluation.config.systemPrompt,
        modelEvaluation.config.includeOntology && !modelEvaluation.config.enableZeroShotOntologyByExample,
        modelEvaluation.config.structuredOutput
      );

      // Get example images if zero-shot ontology by example is enabled
      const exampleImages = modelEvaluation.config.enableZeroShotOntologyByExample 
        ? getAllExampleImages() 
        : undefined;

      // Make API call with retry logic
      let response_data;
      let retryCount = 0;
      const maxRetries = 3;
      
      console.log('Making API call with retry logic, attempt:', retryCount + 1);
      
      while (retryCount < maxRetries) {
        try {
          console.log('API call attempt:', retryCount + 1, 'for image:', img.id);
          response_data = await analyzeImageWithLLM(
            {
              provider: modelEvaluation.model.provider,
              model: modelEvaluation.model.id,
              apiKey: process.env[`REACT_APP_${modelEvaluation.model.provider.toUpperCase()}_API_KEY`] || ''
            },
            enhancedPrompt,
            base64,
            exampleImages
          );
          
          if (response_data.content && response_data.content.trim() !== '') {
            break;
          }
          
          if (retryCount < maxRetries - 1) {
            console.log(`Empty response for rerun, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          } else {
            console.error(`Failed to get valid response after ${maxRetries} attempts for rerun`);
            break;
          }
        } catch (error) {
          console.error(`API call failed for rerun, attempt ${retryCount + 1}:`, error);
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          } else {
            throw error;
          }
        }
      }

      const apiDuration = response_data?.duration || 0;
      console.log('API response for rerun:', {
        hasContent: !!response_data?.content,
        contentLength: response_data?.content?.length || 0,
        duration: apiDuration,
        error: response_data?.error
      });
      
      const parsed = parseLLMResponse(response_data?.content || '');
      console.log('Parsed response for rerun:', parsed);
      
      const dimensions = await getImageDimensions(img.imageUrl);
      const cost = calculateAPICost(
        modelEvaluation.model.provider,
        modelEvaluation.model.id,
        dimensions.width,
        dimensions.height,
        response_data?.usage?.prompt_tokens || 0,
        response_data?.usage?.completion_tokens || 0
      );
      
      const score = calculateImageScore(
        img.actualObjects,
        img.actualClasses,
        parsed.count,
        parsed.classes
      );

      const updatedImg: EvaluationImage = {
        ...img,
        predictedObjects: parsed.count,
        predictedClasses: parsed.classes,
        predictedClassNames: parsed.classes.map(classId => {
          const aircraft = require('../services/ontologyService').getAircraftById(classId);
          return aircraft ? aircraft.name : `Unknown (${classId})`;
        }),
        predictedCountConfidence: parsed.countConfidence,
        predictedClassConfidences: parsed.classConfidences,
        llmResponse: response_data?.content || (response_data?.error ? `Error: ${response_data.error}` : ''),
        apiDuration: apiDuration,
        cost: cost,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
        score: score,
        status: 'completed'
      };

      // Update the specific image in the results
      setModelEvaluations(prev => {
        const currentEvaluation = prev[modelId];
        if (!currentEvaluation || !currentEvaluation.results) return prev;

        const updatedImages = [...currentEvaluation.results.images];
        updatedImages[imageIndex] = { ...updatedImg };
        
        // Recalculate totals
        const totalCost = updatedImages.reduce((sum, img) => sum + (img.cost || 0), 0);
        const totalDuration = updatedImages.reduce((sum, img) => sum + (img.apiDuration || 0), 0);
        const completedImages = updatedImages.filter(img => img.status === 'completed').length;
        const failedImages = updatedImages.filter(img => img.status === 'failed').length;
        
        const countAccuracies = updatedImages
          .filter(img => img.status === 'completed' && img.score)
          .map(img => img.score!.countAccuracy);
        const classAccuracies = updatedImages
          .filter(img => img.status === 'completed' && img.score)
          .map(img => img.score!.classAccuracy);
        
        const averageCountAccuracy = countAccuracies.length > 0 
          ? countAccuracies.reduce((sum, acc) => sum + acc, 0) / countAccuracies.length 
          : 0;
        const averageClassAccuracy = classAccuracies.length > 0 
          ? classAccuracies.reduce((sum, acc) => sum + acc, 0) / classAccuracies.length 
          : 0;

        console.log('Updating state after successful rerun:', {
          modelId,
          imageIndex,
          updatedImg: {
            id: updatedImg.id,
            status: updatedImg.status,
            predictedObjects: updatedImg.predictedObjects,
            hasLlmResponse: !!updatedImg.llmResponse
          },
          updatedImagesLength: updatedImages.length,
          imageAtIndex: updatedImages[imageIndex]
        });

        const newState = {
          ...prev,
          [modelId]: {
            ...currentEvaluation,
            images: updatedImages, // Sync the main images array too
            results: {
              ...currentEvaluation.results,
              images: updatedImages,
              totalCost,
              duration: totalDuration,
              completedImages,
              failedImages,
              averageCountAccuracy,
              averageClassAccuracy
            }
          }
        };
        
        console.log('New state after rerun update:', {
          modelId,
          imageIndex,
          newImageData: newState[modelId]?.results?.images[imageIndex],
          totalImagesInResults: newState[modelId]?.results?.images?.length,
          imageId: newState[modelId]?.results?.images[imageIndex]?.id
        });
        
        return newState;
      });

    } catch (error) {
      console.error('Error rerunning image evaluation:', error);
      
      // Mark as failed
      setModelEvaluations(prev => {
        const currentEvaluation = prev[modelId];
        if (!currentEvaluation || !currentEvaluation.results) return prev;

        const updatedImages = [...currentEvaluation.results.images];
        updatedImages[imageIndex] = {
          ...updatedImages[imageIndex],
          status: 'failed' as const,
          llmResponse: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };

        return {
          ...prev,
          [modelId]: {
            ...currentEvaluation,
            images: updatedImages, // Sync the main images array too
            results: {
              ...currentEvaluation.results,
              images: updatedImages
            }
          }
        };
      });
    }
  }, [modelEvaluations]);
  // Stop evaluation - sets isRunning to false and clears results
  const stopEvaluation = useCallback((modelId: string) => {
    stopFlags.current[modelId] = true;
    setModelEvaluations(prev => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        isRunning: false,
        results: null,
        images: prev[modelId].images.map(img => ({
          ...img,
          status: 'pending' as const,
          score: undefined,
          predictedObjects: 0,
          predictedClasses: [],
          predictedCountConfidence: undefined,
          predictedClassConfidences: [],
          llmResponse: '',
          apiDuration: 0,
          cost: 0
        }))
      }
    }));
  }, []);

  // Reset evaluation - clears results and resets all images to pending state  
  const resetEvaluation = useCallback((modelId: string) => {
    setModelEvaluations(prev => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        isRunning: false,
        currentImageIndex: 0,
        progress: 0,
        results: null,
        images: prev[modelId].images.map(img => ({
          ...img,
          status: 'pending' as const,
          score: undefined,
          predictedObjects: 0,
          predictedClasses: [],
          predictedCountConfidence: undefined,
          predictedClassConfidences: [],
          llmResponse: '',
          apiDuration: 0,
          cost: 0
        }))
      }
    }));
  }, []);
  // Handle CSV file upload
  const handleCSVUpload = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      if (!file.name.endsWith('.csv')) {
        console.error('Only CSV files are supported');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvContent = e.target?.result as string;
          const parsedData = parseCSVToEvaluationData(csvContent);
          
          // Extract model name from filename (e.g., "evaluation-results-gpt-4o-2024-01-01.csv")
          const modelNameMatch = file.name.match(/evaluation-results-(.+?)-\d{4}-\d{2}-\d{2}\.csv$/);
          const modelName = modelNameMatch ? modelNameMatch[1] : file.name.replace('.csv', '');
          
          setUploadedResults(prev => ({
            ...prev,
            [modelName]: {
              ...parsedData,
              modelName
            }
          }));
          
          console.log(`Uploaded CSV data for model: ${modelName}`, parsedData);
        } catch (error) {
          console.error('Error parsing CSV file:', error);
          alert(`Error parsing CSV file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  // Generate sample from single CSV file (for previous run image selection)
  const generateSampleFromCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const parsedData = parseCSVToEvaluationData(csvContent);
        
        console.log('Parsed CSV data:', parsedData.images.length, 'images');
        
        // Create sample images with only the basic info needed (no results)
        const sampleImages = parsedData.images.map(img => ({
          id: img.id,
          filename: img.filename,
          subset: img.subset,
          imageUrl: img.imageUrl,
          actualObjects: img.actualObjects,
          actualClasses: img.actualClasses,
          actualClassNames: img.actualClassNames,
          predictedObjects: 0,
          predictedClasses: [],
          predictedClassNames: [],
          status: 'pending' as const,
          score: undefined,
          cost: 0,
          apiDuration: 0,
          llmResponse: '',
          imageWidth: img.imageWidth,
          imageHeight: img.imageHeight
        }));
        
        // Create config with new sample size
        const newConfig: EvaluationConfig = {
          sampleSize: sampleImages.length,
          llmProvider: '',
          llmModel: '',
          systemPrompt: '',
          subset: 'train',
          includeOntology: true,
          enableZeroShotOntologyByExample: false,
          structuredOutput: true,
          apiDelaySeconds: 0
        };
        
        const newEvaluations: Record<string, ModelEvaluation> = {};
        
        // Create evaluations for selected models with the CSV images
        selectedModels.forEach(model => {
          newEvaluations[model.id] = {
            model,
            images: [...sampleImages], // Copy the array for each model
            results: {
              config: newConfig,
              startTime: new Date(),
              images: [...sampleImages], // Also put images in results for UI compatibility
              averageCountAccuracy: 0,
              averageClassAccuracy: 0,
              totalCost: 0,
              duration: 0
            },
            isRunning: false,
            currentImageIndex: 0,
            progress: 0,
            config: newConfig
          };
        });

        setModelEvaluations(newEvaluations);
        
        console.log('Generated evaluations:', Object.keys(newEvaluations));
        console.log('First evaluation structure:', newEvaluations[selectedModels[0]?.id]);
        
        // Switch to the first model tab
        if (selectedModels.length > 0) {
          console.log('Switching to tab:', selectedModels[0].id);
          setActiveTab(selectedModels[0].id);
        }
        
        console.log('Generated sample from CSV with', sampleImages.length, 'images for', selectedModels.length, 'models');
      } catch (error) {
        console.error('Error parsing CSV file:', error);
        alert(`Error parsing CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  }, [selectedModels]);

  // Load previous results for a specific model
  const loadModelResults = useCallback((modelId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const parsedData = parseCSVToEvaluationData(csvContent);
        
        console.log('Loading results for model:', modelId, 'with', parsedData.images.length, 'images');
        
        // Calculate metrics from loaded data
        const completedImages = parsedData.images.filter(img => img.status === 'completed').length;
        const totalCost = parsedData.images.reduce((sum, img) => sum + (img.cost || 0), 0);
        const totalDuration = parsedData.images.reduce((sum, img) => sum + (img.apiDuration || 0), 0);
        
        const countAccuracies = parsedData.images
          .filter(img => img.status === 'completed' && img.score)
          .map(img => img.score!.countAccuracy);
        const classAccuracies = parsedData.images
          .filter(img => img.status === 'completed' && img.score)
          .map(img => img.score!.classAccuracy);
        
        const averageCountAccuracy = countAccuracies.length > 0 
          ? countAccuracies.reduce((sum, acc) => sum + acc, 0) / countAccuracies.length 
          : 0;
        const averageClassAccuracy = classAccuracies.length > 0 
          ? classAccuracies.reduce((sum, acc) => sum + acc, 0) / classAccuracies.length 
          : 0;
        
        setModelEvaluations(prev => {
          const currentEvaluation = prev[modelId];
          if (!currentEvaluation) {
            console.error('Model evaluation not found:', modelId, 'Available models:', Object.keys(prev));
            alert('Please generate a sample first before uploading model results.');
            return prev;
          }

          // If there are no images in the current evaluation, we need to create a basic structure
          if (!currentEvaluation.images || currentEvaluation.images.length === 0) {
            console.log('No images in current evaluation, creating basic structure');
            const basicImages = parsedData.images.map(img => ({
              ...img,
              status: img.status || 'completed' as const,
              // Keep the original score from parsed data
              score: img.score,
              // Keep the original predicted data from parsed data
              predictedObjects: img.predictedObjects,
              predictedClasses: img.predictedClasses,
              predictedClassNames: img.predictedClassNames,
              llmResponse: img.llmResponse,
              cost: img.cost,
              apiDuration: img.apiDuration
            }));

            return {
              ...prev,
              [modelId]: {
                ...currentEvaluation,
                images: basicImages,
                results: {
                  config: currentEvaluation.config,
                  startTime: new Date(),
                  images: parsedData.images,
                  averageCountAccuracy,
                  averageClassAccuracy,
                  totalCost,
                  duration: totalDuration
                },
                isRunning: false,
                currentImageIndex: parsedData.images.length,
                progress: completedImages === parsedData.images.length ? 100 : (completedImages / parsedData.images.length) * 100
              }
            };
          }

          // Update existing evaluation with loaded results
          return {
            ...prev,
            [modelId]: {
              ...currentEvaluation,
              images: parsedData.images,
              results: {
                config: currentEvaluation.config,
                startTime: new Date(),
                images: parsedData.images,
                averageCountAccuracy,
                averageClassAccuracy,
                totalCost,
                duration: totalDuration
              },
              isRunning: false,
              currentImageIndex: parsedData.images.length,
              progress: completedImages === parsedData.images.length ? 100 : (completedImages / parsedData.images.length) * 100
            }
          };
        });
        
        console.log('Successfully loaded results for model:', modelId);
      } catch (error) {
        console.error('Error loading model results:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Error loading results: ${errorMessage}\n\nPlease check that the CSV file is from a valid evaluation export.`);
      }
    };
    reader.readAsText(file);
  }, []);

  // Clear uploaded results
  const clearUploadedResults = useCallback(() => {
    setUploadedResults({});
  }, []);


  return {
    allImages,
    selectedModels,
    modelEvaluations,
    activeTab,
    setActiveTab,
    loading,
    loadAllImages,
    addModel,
    removeModel,
    generateSample,
    runEvaluation,
    rerunImageEvaluation,
    downloadReport,
    downloadCSV,
    downloadAllResults,
    calculateEstimatedCost,
    stopEvaluation,
    resetEvaluation,
    handleCSVUpload,
    generateSampleFromCSV,
    loadModelResults,
    clearUploadedResults,
    uploadedResults
  };
};
