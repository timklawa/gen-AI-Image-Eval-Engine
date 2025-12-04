import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ImageData, LLMConfig } from '../types';
import { datasetSubsets, classNames, convertToPixelCoordinates, loadImageById } from '../services/datasetService';
import { LLM_PROVIDERS, getModelsByProvider } from '../services/llmProviders';
import { analyzeImageWithLLM } from '../services/llmApiService';

const ImageDetail: React.FC = () => {
  const { subset, imageId } = useParams<{ subset: string; imageId: string }>();
  const navigate = useNavigate();
  
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [prompt, setPrompt] = useState('Count and classify all objects in this image. Provide the count for each class and describe what you see.');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [availableModels, setAvailableModels] = useState(getModelsByProvider());

  const loadCurrentImageData = useCallback(async () => {
    if (!subset || !imageId) return;
    
    try {
      // Load specific image by ID
      const subsetData = datasetSubsets.find(s => s.name === subset);
      if (!subsetData) return;

      const image = await loadImageById(subsetData, imageId);
      
      if (!image) {
        throw new Error('Image not found');
      }
      
      setImageData(image);
    } catch (err) {
      setError('Failed to load image data');
      console.error('Error loading image data:', err);
    }
  }, [subset, imageId]);

  useEffect(() => {
    loadCurrentImageData();
  }, [loadCurrentImageData]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
  };

  const handleAnalyze = async () => {
    if (!imageData || !prompt.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Convert image to base64
      const imageBase64 = await convertImageToBase64(imageData.imagePath);
      
      // Call multi-provider LLM API
      const response = await analyzeImageWithLLM({
        provider: selectedProvider,
        model: selectedModel,
        apiKey: process.env[LLM_PROVIDERS.find(p => p.id === selectedProvider)?.apiKeyEnv || ''] || ''
      }, prompt, imageBase64);
      
      if (response.error) {
        throw new Error(response.error);
      }
      setAiResponse(response.content);
    } catch (err) {
      const provider = LLM_PROVIDERS.find(p => p.id === selectedProvider);
      setError(`Failed to analyze image. Please check your ${provider?.apiKeyEnv || 'API key'} environment variable.`);
      console.error('Error analyzing image:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const convertImageToBase64 = async (imagePath: string): Promise<string> => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data:image/jpeg;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  const renderBoundingBoxes = () => {
    if (!imageData || !showLabels || !imageLoaded) return null;

    return imageData.annotations.map((annotation, index) => {
      const coords = convertToPixelCoordinates(
        annotation,
        imageDimensions.width,
        imageDimensions.height
      );
      
      return (
        <div
          key={index}
          className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
          style={{
            left: coords.x,
            top: coords.y,
            width: coords.width,
            height: coords.height
          }}
        >
          <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap">
            {classNames[annotation.classId] || `Class ${annotation.classId}`} ({annotation.classId})
          </div>
        </div>
      );
    });
  };

  if (!imageData) {
    return <div className="loading">Loading image...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <button 
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 mb-6"
        onClick={() => navigate('/')}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Grid
      </button>

      {/* Image Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 truncate" title={imageData.filename}>{imageData.filename}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Objects</h4>
            <p className="text-2xl font-bold text-gray-900 mt-1">{imageData.objectCount}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Classes Found</h4>
            <p className="text-sm text-gray-900 mt-1 break-words">{imageData.classes.map(c => classNames[c] || `Class ${c}`).join(', ')}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Class IDs</h4>
            <p className="text-sm text-gray-900 mt-1">{imageData.classes.join(', ')}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6">
        <button
          className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
            showLabels 
              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
              : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
          }`}
          onClick={() => setShowLabels(!showLabels)}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
      </div>

      {/* Image Container */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="relative w-full flex justify-center">
          <div className="relative max-w-full">
            <img
              src={imageData.imagePath}
              alt={imageData.filename}
              className="max-w-full h-auto rounded-lg shadow-lg"
              onLoad={handleImageLoad}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
              }}
            />
            {renderBoundingBoxes()}
          </div>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">AI Analysis</h3>
        
        {/* Provider and Model Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LLM Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                const newProvider = e.target.value;
                const providerModels = availableModels[newProvider] || [];
                const firstModel = providerModels.find(m => m.supportsVision)?.id || providerModels[0]?.id || '';
                setSelectedProvider(newProvider);
                setSelectedModel(firstModel);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {LLM_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LLM Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {availableModels[selectedProvider]?.map(model => (
                <option key={model.id} value={model.id} disabled={!model.supportsVision}>
                  {model.name} {!model.supportsVision ? '(No Vision Support)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 mb-4"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt for the AI analysis..."
        />
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAnalyze}
          disabled={isAnalyzing || !prompt.trim()}
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze with AI
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Response */}
      {aiResponse && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">AI Response</h3>
          <div className="bg-gray-50 rounded-md p-4 border-l-4 border-primary-500">
            <pre className="whitespace-pre-wrap text-sm text-gray-700">{aiResponse}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageDetail;
