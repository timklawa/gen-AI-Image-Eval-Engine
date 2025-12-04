import React, { useState, useEffect } from 'react';
import { LLM_PROVIDERS } from '../services/llmProviders';

interface SelectedModel {
  id: string;
  name: string;
  provider: string;
  providerName: string;
}

interface ModelSelectionProps {
  selectedModels: SelectedModel[];
  onAddModel: (model: SelectedModel) => void;
  onRemoveModel: (modelId: string) => void;
  sampleSize: number;
  onSampleSizeChange: (size: number) => void;
  apiDelaySeconds: number;
  onApiDelayChange: (delay: number) => void;
  onGenerateSample: () => void;
  onGenerateSampleFromCSV: (file: File) => void;
  disabled: boolean;
}

const ModelSelection: React.FC<ModelSelectionProps> = ({
  selectedModels,
  onAddModel,
  onRemoveModel,
  sampleSize,
  onSampleSizeChange,
  apiDelaySeconds,
  onApiDelayChange,
  onGenerateSample,
  onGenerateSampleFromCSV,
  disabled
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [sampleMode, setSampleMode] = useState<'random' | 'previous'>('random');
  const [uploadedCSVFile, setUploadedCSVFile] = useState<File | null>(null);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownOpen && !(event.target as Element).closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Prevent scroll when file dialog is open
  useEffect(() => {
    if (isFileDialogOpen) {
      // Use a more targeted approach that doesn't interfere with layout
      const originalOverflow = document.documentElement.style.overflow;
      const originalBodyOverflow = document.body.style.overflow;
      
      // Only prevent scrolling, don't change positioning
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      
      // Listen for window focus to detect dialog closure
      const handleWindowFocus = () => {
        setIsFileDialogOpen(false);
      };
      
      window.addEventListener('focus', handleWindowFocus);
      
      return () => {
        window.removeEventListener('focus', handleWindowFocus);
        
        // Restore original overflow styles
        document.documentElement.style.overflow = originalOverflow;
        document.body.style.overflow = originalBodyOverflow;
      };
    }
  }, [isFileDialogOpen]);

  // Cleanup scroll lock on component unmount
  useEffect(() => {
    return () => {
      // Ensure scroll lock is removed when component unmounts
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleModelSelect = (model: any) => {
    const selectedModel: SelectedModel = {
      id: model.id,
      name: model.name,
      provider: model.provider,
      providerName: LLM_PROVIDERS.find(p => p.id === model.provider)?.name || model.provider
    };
    onAddModel(selectedModel);
    setIsDropdownOpen(false);
    setSelectedProvider('');
  };

  const availableModels = LLM_PROVIDERS.flatMap(provider => 
    provider.models.map(model => ({ ...model, provider: provider.id, providerName: provider.name }))
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Models for Evaluation</h2>
      
      {/* Sample Size and Add Model Row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sample Size
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={sampleSize}
            onChange={(e) => onSampleSizeChange(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Delay (seconds)
          </label>
          <input
            type="number"
            min="0"
            max="30"
            step="0.5"
            value={apiDelaySeconds}
            onChange={(e) => onApiDelayChange(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Delay between API calls"
          />
        </div>
        
        <div className="flex-1 relative dropdown-container">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Model
          </label>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center"
          >
            <span className="text-gray-700">
              {selectedProvider ? `Select from ${selectedProvider}` : 'Select a provider and model'}
            </span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {LLM_PROVIDERS.map(provider => (
                <div key={provider.id}>
                  <div className="px-3 py-2 bg-gray-100 text-sm font-medium text-gray-700 border-b">
                    {provider.name}
                  </div>
                  {provider.models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect({ ...model, provider: provider.id, providerName: provider.name })}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Models */}
      {selectedModels.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Models ({selectedModels.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedModels.map(model => (
              <div
                key={model.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-200"
              >
                <span className="font-medium">{model.name}</span>
                <button
                  onClick={() => onRemoveModel(model.id)}
                  className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Generation Options */}
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Sample Generation</h3>
          
          {/* Toggle between modes */}
          <div className="mb-4">
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setSampleMode('random')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  sampleMode === 'random'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sample Size
              </button>
              <button
                onClick={() => setSampleMode('previous')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  sampleMode === 'previous'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Previous Run
              </button>
            </div>
          </div>

          {sampleMode === 'random' ? (
            /* Random Sample Mode */
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <label className="text-sm text-gray-600">Generate random sample from dataset</label>
                <p className="text-xs text-gray-500 mt-1">Uses the sample size specified above</p>
              </div>
              <button
                onClick={onGenerateSample}
                disabled={disabled || selectedModels.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Generate Sample
              </button>
            </div>
          ) : (
            /* Previous Run Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <label className="text-sm text-gray-600">Upload CSV from previous evaluation</label>
                  <p className="text-xs text-gray-500 mt-1">Uses same images and sample size as the uploaded run</p>
                </div>
                <label htmlFor="previous-run-csv" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer">
                  Upload CSV
                  <input
                    id="previous-run-csv"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onClick={() => {
                      setIsFileDialogOpen(true);
                    }}
                    onChange={(e) => {
                      setIsFileDialogOpen(false);
                      if (e.target.files && e.target.files[0]) {
                        setUploadedCSVFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
              
              {/* Show uploaded file info and generate button */}
              {uploadedCSVFile && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-800">{uploadedCSVFile.name}</p>
                        <p className="text-xs text-green-600">Ready to generate sample</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          onGenerateSampleFromCSV(uploadedCSVFile);
                          setUploadedCSVFile(null); // Clear after generating
                        }}
                        disabled={disabled || selectedModels.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Generate Sample
                      </button>
                      <button
                        onClick={() => setUploadedCSVFile(null)}
                        className="px-2 py-2 text-green-600 hover:text-green-800"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelSelection;
