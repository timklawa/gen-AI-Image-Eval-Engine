import React, { useState, useEffect, useCallback } from 'react';
import { EvaluationConfig } from '../services/evalService';
import { getDefaultSystemPrompt, getDefaultStructuredOutput, getUIConfig, formatOntologyForDisplay } from '../services/evalConfigService';
import { LLM_PROVIDERS } from '../services/llmProviders';
import { useEvaluation } from '../hooks/useEvaluation';
import ModelSelection from './ModelSelection';
import EvaluationTabs from './EvaluationTabs';
import ModelEvaluationContent from './ModelEvaluationContent';
import SummaryAnalysisContent from './SummaryAnalysisContent';

const Eval: React.FC = () => {
  const [config, setConfig] = useState<EvaluationConfig>(() => {
    const uiConfig = getUIConfig();
    const defaultSystemPrompt = getDefaultSystemPrompt();
    const defaultStructuredOutput = getDefaultStructuredOutput();
    
    return {
      sampleSize: uiConfig.defaultSampleSize,
      llmProvider: 'openai',
      llmModel: 'gpt-4o',
      systemPrompt: defaultSystemPrompt,
      subset: 'train',
      includeOntology: true,
      enableZeroShotOntologyByExample: false,
      structuredOutput: defaultStructuredOutput.enabled,
      apiDelaySeconds: 2
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showClassDefinitions, setShowClassDefinitions] = useState(false);
  const [rerunningImage, setRerunningImage] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const {
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
    stopEvaluation,
    resetEvaluation,
    generateSampleFromCSV,
    loadModelResults
  } = useEvaluation();

  useEffect(() => {
    loadAllImages();
  }, [loadAllImages]);

  const handleGenerateSample = useCallback(() => {
    generateSample(config);
  }, [generateSample, config]);

  const handleRunEvaluation = useCallback((modelId: string) => {
    runEvaluation(modelId, config);
  }, [runEvaluation, config]);

  const handleRerunImage = useCallback(async (modelId: string, imageIndex: number) => {
    const evaluation = modelEvaluations[modelId];
    if (!evaluation || !evaluation.results) return;
    
    const img = evaluation.results.images[imageIndex];
    if (!img) return;
    
    // Set loading state
    setRerunningImage(img.id);
    
    try {
      await rerunImageEvaluation(modelId, imageIndex);
    } finally {
      // Clear loading state
      setRerunningImage(null);
    }
  }, [modelEvaluations, rerunImageEvaluation]);

  const currentEvaluation = activeTab !== 'config' && activeTab !== 'summary' 
    ? modelEvaluations[activeTab] 
    : null;

  const currentImages = currentEvaluation?.results?.images.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || currentEvaluation?.images.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || [];

  // Debug logging for currentImages
  console.log('Current images for UI:', {
    hasResults: !!currentEvaluation?.results,
    resultsImagesLength: currentEvaluation?.results?.images?.length,
    originalImagesLength: currentEvaluation?.images?.length,
    currentImagesLength: currentImages.length,
    currentPage,
    itemsPerPage,
    activeTab,
    modelEvaluationsKeys: Object.keys(modelEvaluations),
    currentEvaluationExists: !!currentEvaluation
  });

  const totalPages = currentEvaluation 
    ? Math.ceil((currentEvaluation.results?.images.length || currentEvaluation.images.length) / itemsPerPage)
    : 0;

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const completedImages = currentEvaluation?.results?.images.filter(img => img.status === 'completed').length || 
    currentEvaluation?.images.filter(img => img.status === 'completed').length || 0;
  const totalImages = currentEvaluation?.results?.images.length || currentEvaluation?.images.length || 0;
  const progressPercentage = currentEvaluation ? currentEvaluation.progress : 0;

  const averageApiTime = (() => {
    const images = currentEvaluation?.results?.images || currentEvaluation?.images;
    if (!images || completedImages === 0) return 0;
    const totalDuration = images
      .filter(img => img.apiDuration)
      .reduce((sum, img) => sum + (img.apiDuration || 0), 0);
    return totalDuration / completedImages;
  })();

  const estimatedRemainingTime = averageApiTime > 0 
    ? ((totalImages - completedImages) * averageApiTime) / 1000 
    : 0;

  const estimatedTotalTime = averageApiTime > 0 
    ? (totalImages * averageApiTime) / 1000 
    : 0;

  const calculateEstimatedCost = useCallback((modelId: string, sampleSize: number): number => {
    const model = selectedModels.find(m => m.id === modelId);
    if (!model) return 0;

    const provider = LLM_PROVIDERS.find(p => p.id === model.provider);
    const modelConfig = provider?.models.find(m => m.id === modelId);
    
    if (!modelConfig || !modelConfig.costPer1kInput || !modelConfig.costPer1kOutput) {
      return 0;
    }

    const estimatedPromptTokens = 200;
    const estimatedImageTokens = 170; // For 1024x1024 images
    const estimatedResponseTokens = 100;
    
    const totalInputTokens = estimatedPromptTokens + estimatedImageTokens;
    const totalOutputTokens = estimatedResponseTokens;
    
    const costPerImage = 
      (totalInputTokens / 1000) * modelConfig.costPer1kInput +
      (totalOutputTokens / 1000) * modelConfig.costPer1kOutput;
    
    return costPerImage * sampleSize;
  }, [selectedModels]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dataset...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LLM Evaluation Platform</h1>
          <p className="mt-2 text-gray-600">
            Evaluate multiple LLM models on aircraft detection and classification tasks
          </p>
        </div>

        <div className="space-y-6">
          {/* Experiment Prompt Config */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Experiment Prompt Config</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={config.systemPrompt}
                  onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter system prompt..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  JSON Output Requirements
                </label>
                <textarea
                  value={getDefaultStructuredOutput().example}
                  readOnly
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                  placeholder="JSON output requirements..."
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.includeOntology}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeOntology: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Include Ontology in System Prompt</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.enableZeroShotOntologyByExample}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableZeroShotOntologyByExample: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable Zero Shot Ontology by Example Referencing</span>
              </label>
              {config.enableZeroShotOntologyByExample && (
                <p className="ml-6 text-xs text-gray-500">
                  When enabled, example images for each ontology class will be included in the API call instead of just text-based ontology.
                </p>
              )}
            </div>

            {config.includeOntology && !config.enableZeroShotOntologyByExample && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aircraft Ontology JSON
                </label>
                <textarea
                  value={formatOntologyForDisplay()}
                  readOnly
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                  placeholder="Aircraft classification ontology..."
                />
              </div>
            )}
          </div>

          {/* Model Selection */}
          <ModelSelection
            selectedModels={selectedModels}
            onAddModel={addModel}
            onRemoveModel={removeModel}
            sampleSize={config.sampleSize}
            onSampleSizeChange={(size) => setConfig(prev => ({ ...prev, sampleSize: size }))}
            apiDelaySeconds={config.apiDelaySeconds}
            onApiDelayChange={(delay) => setConfig(prev => ({ ...prev, apiDelaySeconds: delay }))}
            onGenerateSample={handleGenerateSample}
            onGenerateSampleFromCSV={generateSampleFromCSV}
            disabled={loading}
          />

          {/* Evaluation Tabs */}
          {selectedModels.length > 0 && (
            <EvaluationTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              selectedModels={selectedModels}
              modelEvaluations={modelEvaluations}
            >
              {activeTab === 'summary' ? (
                <SummaryAnalysisContent
                  modelEvaluations={modelEvaluations}
                  selectedModels={selectedModels}
                  onDownloadAllResults={downloadAllResults}
                  calculateEstimatedCost={calculateEstimatedCost}
                  expandedChart={expandedChart}
                  setExpandedChart={setExpandedChart}
                />
              ) : currentEvaluation && (
                <ModelEvaluationContent
                  evaluation={currentEvaluation}
                  onRunEvaluation={handleRunEvaluation}
                  onRerunImage={handleRerunImage}
                  onDownloadReport={downloadReport}
                  onDownloadCSV={downloadCSV}
                  onLoadModelResults={loadModelResults}
                  currentImages={currentImages}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  goToPage={goToPage}
                  completedImages={completedImages}
                  totalImages={totalImages}
                  progressPercentage={progressPercentage}
                  calculateEstimatedCost={calculateEstimatedCost}
                  averageApiTime={averageApiTime}
                  estimatedRemainingTime={estimatedRemainingTime}
                  estimatedTotalTime={estimatedTotalTime}
                  showClassDefinitions={showClassDefinitions}
                  setShowClassDefinitions={setShowClassDefinitions}
                  showOutput={showOutput}
                  setShowOutput={setShowOutput}
                  showScoreInfo={showScoreInfo}
                  setShowScoreInfo={setShowScoreInfo}
                  selectedOutput={selectedOutput}
                  setSelectedOutput={setSelectedOutput}
                  selectedInput={selectedInput}
                  setSelectedInput={setSelectedInput}
                  expandedChart={expandedChart}
                  setExpandedChart={setExpandedChart}
                  rerunningImage={rerunningImage}
                  onStopEvaluation={stopEvaluation}
                  onResetEvaluation={resetEvaluation}
                />
              )}
            </EvaluationTabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default Eval;
