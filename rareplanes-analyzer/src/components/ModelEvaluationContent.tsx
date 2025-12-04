import React, { useState } from 'react';
import { EvaluationImage, EvaluationResult, getEnhancedSystemPrompt } from '../services/evalService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ScatterChart, Scatter } from 'recharts';
import { LLM_PROVIDERS } from '../services/llmProviders';
import ChartModal from './ChartModal';

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
  config: EvaluationResult['config'];
}

interface ModelEvaluationContentProps {
  evaluation: ModelEvaluation;
  onRunEvaluation: (modelId: string) => void;
  onRerunImage: (modelId: string, imageIndex: number) => void;
  onDownloadReport: (modelId: string) => void;
  onDownloadCSV: (modelId: string) => void;
  onLoadModelResults: (modelId: string, file: File) => void;
  currentImages: EvaluationImage[];
  totalPages: number;
  currentPage: number;
  goToPage: (page: number) => void;
  completedImages: number;
  totalImages: number;
  progressPercentage: number;
  calculateEstimatedCost: (modelId: string, sampleSize: number) => number;
  averageApiTime: number;
  estimatedRemainingTime: number;
  estimatedTotalTime: number;
  showClassDefinitions: boolean;
  setShowClassDefinitions: (show: boolean) => void;
  showOutput: boolean;
  setShowOutput: (show: boolean) => void;
  showScoreInfo: boolean;
  setShowScoreInfo: (show: boolean) => void;
  selectedOutput: string;
  setSelectedOutput: (output: string) => void;
  selectedInput?: string;
  setSelectedInput?: (input: string) => void;
  expandedChart: string | null;
  setExpandedChart: (chart: string | null) => void;
  rerunningImage: string | null;
  onStopEvaluation: (modelId: string) => void;
  onResetEvaluation: (modelId: string) => void;
}

const ModelEvaluationContent: React.FC<ModelEvaluationContentProps> = ({
  evaluation,
  onRunEvaluation,
  onRerunImage,
  onDownloadReport,
  onDownloadCSV,
  onLoadModelResults,
  currentImages,
  totalPages,
  currentPage,
  goToPage,
  completedImages,
  totalImages,
  progressPercentage,
  calculateEstimatedCost,
  averageApiTime,
  estimatedRemainingTime,
  estimatedTotalTime,
  showClassDefinitions,
  setShowClassDefinitions,
  showOutput,
  setShowOutput,
  showScoreInfo,
  setShowScoreInfo,
  selectedOutput,
  setSelectedOutput,
  selectedInput,
  setSelectedInput,
  expandedChart,
  setExpandedChart,
  rerunningImage,
  onStopEvaluation,
  onResetEvaluation
}) => {
  const isRunning = evaluation.progress > 0 && evaluation.progress < 100;
  const isCompleted = evaluation.results !== null;
  const [outputTab, setOutputTab] = useState<'input' | 'output'>('output');

  // Helper function to calculate standard deviation
  const calculateStandardDeviation = (values: number[]): number => {
    if (values.length === 0) return 0;
    const validValues = values.filter(val => !isNaN(val) && isFinite(val));
    if (validValues.length === 0) return 0;
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
    return Math.sqrt(variance);
  };

  // Helper function to calculate variance
  const calculateVariance = (values: number[]): number => {
    if (values.length === 0) return 0;
    const validValues = values.filter(val => !isNaN(val) && isFinite(val));
    if (validValues.length === 0) return 0;
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    return validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
  };

  // Helper function to create histogram data
  const createHistogramData = (values: number[], bins: number = 10): Array<{range: string, count: number, percentage: number}> => {
    if (values.length === 0) {
      // Return a default histogram with all zeros when no data
      return Array(bins).fill(0).map((_, i) => ({
        range: `${i * 10}-${(i + 1) * 10}%`,
        count: 0,
        percentage: 0
      }));
    }
    
    const validValues = values.filter(val => !isNaN(val) && isFinite(val));
    if (validValues.length === 0) {
      // Return a default histogram with all zeros when no valid data
      return Array(bins).fill(0).map((_, i) => ({
        range: `${i * 10}-${(i + 1) * 10}%`,
        count: 0,
        percentage: 0
      }));
    }
    
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    
    // Handle case where min === max (all values are the same)
    const binSize = min === max ? 1 : (max - min) / bins;
    
    const histogram = Array(bins).fill(0).map((_, i) => {
      const start = min + i * binSize;
      const end = min + (i + 1) * binSize;
      return {
        range: `${start.toFixed(0)}-${end.toFixed(0)}%`,
        count: 0,
        percentage: 0
      };
    });
    
    validValues.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
      if (histogram[binIndex]) {
        histogram[binIndex].count++;
      }
    });
    
    const total = validValues.length;
    histogram.forEach(bin => {
      bin.percentage = total > 0 ? (bin.count / total) * 100 : 0;
    });
    
    return histogram;
  };

  return (
    <div>
      {/* Header with Action Buttons */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Evaluation Results ({evaluation.images.length} images)
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => onRunEvaluation(evaluation.model.id)}
            disabled={evaluation.isRunning}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {evaluation.isRunning ? `Processing... (${evaluation.currentImageIndex + 1}/${evaluation.images.length})` : 'Run Test'}
          </button>
          {evaluation.results && (
            <>
              <button
                onClick={() => onDownloadReport(evaluation.model.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Download Report
              </button>
              <button
                onClick={() => onDownloadCSV(evaluation.model.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Download CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cost Estimate */}
      {evaluation.images.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                Estimated Cost for {totalImages} images:
              </span>
            </div>
            <span className="text-lg font-bold text-blue-600">
              ${calculateEstimatedCost(evaluation.model.id, totalImages).toFixed(4)}
            </span>
          </div>
          <div className="mt-1 text-xs text-blue-700">
            Based on {evaluation.model.name} pricing: ${LLM_PROVIDERS.find(p => p.id === evaluation.model.provider)?.models.find(m => m.id === evaluation.model.id)?.costPer1kInput || 0}/1k input, ${LLM_PROVIDERS.find(p => p.id === evaluation.model.provider)?.models.find(m => m.id === evaluation.model.id)?.costPer1kOutput || 0}/1k output
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {evaluation.images.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {completedImages}/{totalImages} images completed
            </span>
            <span className="text-sm text-gray-500">
              {averageApiTime > 0 && (
                <>
                  Avg: {Math.round(averageApiTime)}ms | 
                  Est. remaining: {Math.round(estimatedRemainingTime)}s | 
                  Est. total: {Math.round(estimatedTotalTime)}s
                </>
              )}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Load Previous Results */}
      <div className="mb-6">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Load Previous Results</h3>
              <p className="text-xs text-gray-500 mt-1">Upload CSV file to restore previous evaluation results for this model</p>
            </div>
            <label htmlFor={`model-csv-${evaluation.model.id}`} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer">
              Upload Results CSV
              <input
                id={`model-csv-${evaluation.model.id}`}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onLoadModelResults(evaluation.model.id, e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {evaluation.images.length > 0 && (
        <div className="mb-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Evaluation Results</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Predicted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        Count Score
                        <button
                          onClick={() => setShowScoreInfo(true)}
                          className="ml-1 text-gray-400 hover:text-gray-600"
                          title="Score Definition"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        Class Score
                        <button
                          onClick={() => setShowScoreInfo(true)}
                          className="ml-1 text-gray-400 hover:text-gray-600"
                          title="Score Definition"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      API Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentImages.map((img, index) => {
                    const actualIndex = (currentPage - 1) * 10 + index;
                    
                    
                    return (
                      <React.Fragment key={img.id}>
                        <tr className={
                          evaluation.isRunning && actualIndex === evaluation.currentImageIndex ? 'bg-yellow-50' :
                          img.status === 'completed' ? 'bg-green-50' :
                          img.status === 'error' ? 'bg-red-50' :
                          img.status === 'processing' ? 'bg-yellow-50' :
                          'bg-white'
                        }>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center">
                              <img
                                src={img.imageUrl}
                                alt={img.filename}
                                className="h-12 w-12 object-cover rounded mb-2"
                              />
                              <a
                                href={`/image/${img.subset}/${img.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                Image
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">{img.actualObjects} objects</div>
                              <div className="text-xs text-gray-500">Classes: [{img.actualClasses.join(', ')}]</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">
                                {img.predictedObjects !== undefined ? `${img.predictedObjects} objects` : '-'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Classes: [{img.predictedClasses?.join(', ') || '-'}]
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className={`font-medium ${
                                img.score !== undefined 
                                  ? img.score.countAccuracy === 1 ? 'text-green-600' : 'text-red-600'
                                  : 'text-gray-400'
                              }`}>
                                {img.score !== undefined ? `${(img.score.countAccuracy * 100).toFixed(0)}%` : '-'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {img.actualObjects} vs {img.predictedObjects || 0}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className={`font-medium ${
                                img.score !== undefined 
                                  ? img.score.classAccuracy >= 0.8 ? 'text-green-600' : img.score.classAccuracy >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                                  : 'text-gray-400'
                              }`}>
                                {img.score !== undefined ? `${(img.score.classAccuracy * 100).toFixed(0)}%` : '-'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Class accuracy
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {img.apiDuration !== undefined ? `${img.apiDuration}ms` : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {img.cost !== undefined ? `$${img.cost.toFixed(4)}` : '-'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {img.imageWidth && img.imageHeight ? `${img.imageWidth}×${img.imageHeight}` : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              img.status === 'completed' ? 'bg-green-100 text-green-800' :
                              img.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                              img.status === 'error' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {img.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center justify-center space-y-1">
                              {/* Always show Response button if there's any response data */}
                              {(img.llmResponse && img.llmResponse.trim() !== '') ? (
                                <button
                                  onClick={() => {
                                    setSelectedOutput(img.llmResponse || '');
                                    // Reconstruct input prompt from evaluation config
                                    const config = evaluation.results?.config || evaluation.config;
                                    const inputPrompt = getEnhancedSystemPrompt(
                                      config.systemPrompt,
                                      config.includeOntology && !config.enableZeroShotOntologyByExample,
                                      config.structuredOutput
                                    );
                                    if (setSelectedInput) {
                                      setSelectedInput(inputPrompt);
                                    }
                                    setOutputTab('output');
                                    setShowOutput(true);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                  Output
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    const responseText = img.llmResponse || 'No response data available';
                                    setSelectedOutput(responseText);
                                    const config = evaluation.results?.config || evaluation.config;
                                    const inputPrompt = getEnhancedSystemPrompt(
                                      config.systemPrompt,
                                      config.includeOntology && !config.enableZeroShotOntologyByExample,
                                      config.structuredOutput
                                    );
                                    if (setSelectedInput) {
                                      setSelectedInput(inputPrompt);
                                    }
                                    setOutputTab('output');
                                    setShowOutput(true);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
                                >
                                  Response
                                </button>
                              )}
                              
                              {/* Show Rerun button for completed/error images without proper response */}
                              {(img.status === 'completed' || img.status === 'error') && (!img.llmResponse || img.llmResponse.trim() === '' || img.predictedObjects === 0) && (
                                <button
                                  onClick={() => {
                                    console.log('Rerun button clicked for:', { modelId: evaluation.model.id, imageIndex: actualIndex });
                                    onRerunImage(evaluation.model.id, actualIndex);
                                  }}
                                  disabled={rerunningImage === img.id}
                                  className={`px-2 py-1 text-xs font-medium text-white rounded-md ${
                                    rerunningImage === img.id 
                                      ? 'bg-gray-400 cursor-not-allowed' 
                                      : 'bg-orange-600 hover:bg-orange-700'
                                  }`}
                                  title={rerunningImage === img.id ? "Rerunning..." : "Rerun this image"}
                                >
                                  {rerunningImage === img.id ? (
                                    <div className="flex items-center space-x-1">
                                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>Rerunning...</span>
                                    </div>
                                  ) : (
                                    'Rerun'
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="px-2 py-2 text-gray-500">...</span>
                          <button
                            onClick={() => goToPage(totalPages)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalImages)} of {totalImages} results
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall Results Summary */}
      {evaluation.results && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{(evaluation.results.averageCountAccuracy * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Average Count Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{(evaluation.results.averageClassAccuracy * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Average Class Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${evaluation.results.totalCost.toFixed(4)}</div>
              <div className="text-sm text-gray-600">Total Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{(evaluation.results.duration! / 1000).toFixed(1)}s</div>
              <div className="text-sm text-gray-600">Total Duration</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {evaluation.results && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Count Accuracy by Image</h3>
              <button
                onClick={() => setExpandedChart('countAccuracyByImage')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            {(() => {
              const countAccuracies = evaluation.results.images
                .filter(img => img.status === 'completed')
                .map(img => img.score?.countAccuracy || 0);
              const avgAccuracy = countAccuracies.length > 0 ? countAccuracies.reduce((sum, acc) => sum + acc, 0) / countAccuracies.length : 0;
              const stdDev = calculateStandardDeviation(countAccuracies);
              const variance = calculateVariance(countAccuracies);
              
              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Average:</span>
                      <span className="ml-1 text-blue-600 font-semibold">{(avgAccuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Std Dev:</span>
                      <span className="ml-1 text-orange-600 font-semibold">{(stdDev * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Variance:</span>
                      <span className="ml-1 text-purple-600 font-semibold">{(variance * 10000).toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Stability:</span>
                      <span className={`ml-1 font-semibold ${stdDev < 0.1 ? 'text-green-600' : stdDev < 0.2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stdDev < 0.1 ? 'High' : stdDev < 0.2 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart data={evaluation.results.images.map((img, index) => ({
                  imageNumber: index + 1,
                  accuracy: (img.score?.countAccuracy || 0) * 100,
                  actual: img.actualObjects,
                  predicted: img.predictedObjects || 0
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="imageNumber" 
                    label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Percent', angle: -90, position: 'insideLeft' }}
                  />
                  <Legend verticalAlign="top" height={24} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'accuracy' ? `${value.toFixed(1)}%` : value,
                      name === 'accuracy' ? 'Count Accuracy' : name === 'actual' ? 'Actual Count' : 'Predicted Count'
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return `Image ${payload[0].payload.imageNumber}: ${payload[0].payload.actual} actual, ${payload[0].payload.predicted} predicted`;
                      }
                      return `Image ${label}`;
                    }}
                  />
                  <Scatter 
                    dataKey="accuracy" 
                    fill="#3B82F6"
                    r={6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Class Accuracy by Image</h3>
              <button
                onClick={() => setExpandedChart('classAccuracyByImage')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            {(() => {
              const classAccuracies = evaluation.results.images
                .filter(img => img.status === 'completed')
                .map(img => img.score?.classAccuracy || 0);
              const avgAccuracy = classAccuracies.length > 0 ? classAccuracies.reduce((sum, acc) => sum + acc, 0) / classAccuracies.length : 0;
              const stdDev = calculateStandardDeviation(classAccuracies);
              const variance = calculateVariance(classAccuracies);
              
              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Average:</span>
                      <span className="ml-1 text-blue-600 font-semibold">{(avgAccuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Std Dev:</span>
                      <span className="ml-1 text-orange-600 font-semibold">{(stdDev * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Variance:</span>
                      <span className="ml-1 text-purple-600 font-semibold">{(variance * 10000).toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Stability:</span>
                      <span className={`ml-1 font-semibold ${stdDev < 0.1 ? 'text-green-600' : stdDev < 0.2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stdDev < 0.1 ? 'High' : stdDev < 0.2 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart data={evaluation.results.images.map((img, index) => ({
                  imageNumber: index + 1,
                  accuracy: (img.score?.classAccuracy || 0) * 100
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="imageNumber" 
                    label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Percent', angle: -90, position: 'insideLeft' }}
                  />
                  <Legend verticalAlign="top" height={24} />
                  <Tooltip 
                    formatter={(value: any) => [`${value.toFixed(1)}%`, 'Class Accuracy']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return `Image ${payload[0].payload.imageNumber}`;
                      }
                      return `Image ${label}`;
                    }}
                  />
                  <Scatter 
                    dataKey="accuracy" 
                    fill="#10B981"
                    r={6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Histogram Charts */}
      {evaluation.results && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Count Accuracy Distribution</h3>
              <button
                onClick={() => setExpandedChart('countAccuracyDistribution')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={(() => {
                  const countAccuracies = evaluation.results.images
                    .map(img => img.score?.countAccuracy || 0)
                    .filter(acc => acc > 0);
                  return createHistogramData(countAccuracies, 8);
                })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="range" 
                    label={{ value: 'Accuracy Range (%)', position: 'insideBottom', offset: -10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: 'Number of Images', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'count' ? `${value} images` : `${value.toFixed(1)}%`,
                      name === 'count' ? 'Count' : 'Percentage'
                    ]}
                    labelFormatter={(label) => `Range: ${label}`}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#3B82F6" 
                    name="Count"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Class Accuracy Distribution</h3>
              <button
                onClick={() => setExpandedChart('classAccuracyDistribution')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={(() => {
                  const classAccuracies = evaluation.results.images
                    .map(img => img.score?.classAccuracy || 0)
                    .filter(acc => acc > 0);
                  return createHistogramData(classAccuracies, 8);
                })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="range" 
                    label={{ value: 'Accuracy Range (%)', position: 'insideBottom', offset: -10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: 'Number of Images', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'count' ? `${value} images` : `${value.toFixed(1)}%`,
                      name === 'count' ? 'Count' : 'Percentage'
                    ]}
                    labelFormatter={(label) => `Range: ${label}`}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#10B981" 
                    name="Count"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Object Count vs Accuracy Scatter Plots */}
      {evaluation.results && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Object Count vs Count Accuracy</h3>
              <button
                onClick={() => setExpandedChart('objectCountVsCountAccuracy')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart data={evaluation.results.images.map((img, index) => ({
                  actualObjects: img.actualObjects,
                  countAccuracy: (img.score?.countAccuracy || 0) * 100,
                  imageNumber: index + 1
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="actualObjects" 
                    label={{ value: 'Number of Actual Objects', position: 'insideBottom', offset: -10 }}
                    type="number"
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'actualObjects' ? `${value} objects` : `${value.toFixed(1)}%`,
                      name === 'actualObjects' ? 'Actual Objects' : 'Count Accuracy'
                    ]}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return `Image ${data?.imageNumber}: ${data?.actualObjects} objects`;
                    }}
                  />
                  <Scatter 
                    dataKey="countAccuracy" 
                    fill="#3B82F6" 
                    name="Count Accuracy"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Object Count vs Class Accuracy</h3>
              <button
                onClick={() => setExpandedChart('objectCountVsClassAccuracy')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart data={evaluation.results.images.map((img, index) => ({
                  actualObjects: img.actualObjects,
                  classAccuracy: (img.score?.classAccuracy || 0) * 100,
                  imageNumber: index + 1
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="actualObjects" 
                    label={{ value: 'Number of Actual Objects', position: 'insideBottom', offset: -10 }}
                    type="number"
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'actualObjects' ? `${value} objects` : `${value.toFixed(1)}%`,
                      name === 'actualObjects' ? 'Actual Objects' : 'Class Accuracy'
                    ]}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return `Image ${data?.imageNumber}: ${data?.actualObjects} objects`;
                    }}
                  />
                  <Scatter 
                    dataKey="classAccuracy" 
                    fill="#10B981" 
                    name="Class Accuracy"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Confidence Scatter Plots */}
      {evaluation.results && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Count Confidence vs Accuracy</h3>
              <button
                onClick={() => setExpandedChart('countConfidenceVsAccuracy')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart data={evaluation.results.images.map((img, index) => ({
                  confidence: img.predictedCountConfidence ? img.predictedCountConfidence * 100 : 0,
                  accuracy: (img.score?.countAccuracy || 0) * 100,
                  imageNumber: index + 1
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="confidence" 
                    label={{ value: 'Count Confidence (%)', position: 'insideBottom', offset: -10 }}
                    domain={[0, 100]}
                    type="number"
                  />
                  <YAxis 
                    dataKey="accuracy" 
                    label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'confidence' ? `${value.toFixed(1)}%` : 
                      name === 'accuracy' ? `${value.toFixed(1)}%` : value,
                      name === 'confidence' ? 'Count Confidence' : 
                      name === 'accuracy' ? 'Count Accuracy' : 'Image Number'
                    ]}
                  />
                  <Scatter 
                    dataKey="accuracy" 
                    fill="#3B82F6" 
                    r={6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Class Confidence vs Accuracy</h3>
              <button
                onClick={() => setExpandedChart('classConfidenceVsAccuracy')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart data={evaluation.results.images.map((img, index) => {
                  // Calculate average class confidence for this image
                  const avgClassConfidence = img.predictedClassConfidences && img.predictedClassConfidences.length > 0
                    ? img.predictedClassConfidences.reduce((sum, conf) => sum + conf, 0) / img.predictedClassConfidences.length
                    : 0;
                  
                  return {
                    confidence: avgClassConfidence * 100,
                    accuracy: (img.score?.classAccuracy || 0) * 100,
                    imageNumber: index + 1
                  };
                })} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="confidence" 
                    label={{ value: 'Average Class Confidence (%)', position: 'insideBottom', offset: -10 }}
                    domain={[0, 100]}
                    type="number"
                  />
                  <YAxis 
                    dataKey="accuracy" 
                    label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'confidence' ? `${value.toFixed(1)}%` : 
                      name === 'accuracy' ? `${value.toFixed(1)}%` : value,
                      name === 'confidence' ? 'Avg Class Confidence' : 
                      name === 'accuracy' ? 'Class Accuracy' : 'Image Number'
                    ]}
                  />
                  <Scatter 
                    dataKey="accuracy" 
                    fill="#10B981" 
                    r={6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Class Performance Chart */}
      {evaluation.results && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 pb-24">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Accuracy by Class ID</h3>
              <button
                onClick={() => setExpandedChart('accuracyByClassId')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            <div className="overflow-visible">
            <ResponsiveContainer width="100%" height={550}>
              <BarChart data={(() => {
                // Class name mapping from evalConfig
                const classNames: { [key: number]: string } = {
                  0: "Large Civil Transport",
                  1: "Medium Civil Transport", 
                  2: "Military Bomber",
                  3: "Military Fighter",
                  4: "Military Trainer",
                  5: "Military Transport",
                  6: "Small Civil Transport"
                };

                // Calculate accuracy for each class ID based on instance counts
                const classAccuracies: { [key: number]: { correct: number; total: number } } = {};
                
                evaluation.results?.images.forEach(img => {
                  if (img.score && img.actualClasses && img.predictedClasses) {
                    // Count actual instances of each class
                    const actualCounts = new Map<number, number>();
                    img.actualClasses.forEach(actualClass => {
                      actualCounts.set(actualClass, (actualCounts.get(actualClass) || 0) + 1);
                    });

                    // Count predicted instances of each class
                    const predictedCounts = new Map<number, number>();
                    img.predictedClasses.forEach(predictedClass => {
                      predictedCounts.set(predictedClass, (predictedCounts.get(predictedClass) || 0) + 1);
                    });

                    // Calculate accuracy for each class present in the image
                    actualCounts.forEach((actualCount, classId) => {
                      if (!classAccuracies[classId]) {
                        classAccuracies[classId] = { correct: 0, total: 0 };
                      }
                      
                      const predictedCount = predictedCounts.get(classId) || 0;
                      const correctCount = Math.min(actualCount, predictedCount);
                      
                      classAccuracies[classId].correct += correctCount;
                      classAccuracies[classId].total += actualCount;
                    });
                  }
                });

                // Include all classes that appear in the dataset, even those with 0% accuracy
                const allClassIds = new Set<number>();
                evaluation.results?.images.forEach(img => {
                  if (img.actualClasses) {
                    img.actualClasses.forEach(classId => allClassIds.add(classId));
                  }
                  if (img.predictedClasses) {
                    img.predictedClasses.forEach(classId => allClassIds.add(classId));
                  }
                });

                return Array.from(allClassIds).map(classId => {
                  const stats = classAccuracies[classId] || { correct: 0, total: 0 };
                  return {
                    classId: `${classId} - ${classNames[classId] || `Class ${classId}`}`,
                    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
                    correct: stats.correct,
                    total: stats.total
                  };
                }).sort((a, b) => b.accuracy - a.accuracy);
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="classId" 
                  angle={-45} 
                  textAnchor="end" 
                  height={140}
                  label={{ value: 'Class ID', position: 'insideBottom', offset: -15 }}
                  interval={0}
                />
                <YAxis domain={[0, 100]} label={{ value: 'Percent', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'accuracy' ? `${value.toFixed(1)}%` : value,
                    name === 'accuracy' ? 'Accuracy' : name === 'correct' ? 'Correct' : 'Total'
                  ]}
                />
                <Bar 
                  dataKey="accuracy" 
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                  onClick={() => setExpandedChart('class-accuracy')}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* API Time Chart */}
      {evaluation.results && (
        <div className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 pb-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">API Time per Image</h3>
              <button
                onClick={() => setExpandedChart('apiTimePerImage')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Expand
              </button>
            </div>
            {(() => {
              const apiTimes = evaluation.results.images
                .map(img => img.apiDuration || 0)
                .filter(time => time > 0 && !isNaN(time) && isFinite(time));
              const avgTime = apiTimes.length > 0 ? apiTimes.reduce((sum, time) => sum + time, 0) / apiTimes.length : 0;
              const stdDev = calculateStandardDeviation(apiTimes);
              const variance = calculateVariance(apiTimes);
              
              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Average:</span>
                      <span className="ml-1 text-blue-600 font-semibold">{avgTime.toFixed(0)}ms</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Std Dev:</span>
                      <span className="ml-1 text-orange-600 font-semibold">{stdDev.toFixed(0)}ms</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Variance:</span>
                      <span className="ml-1 text-purple-600 font-semibold">{variance.toFixed(0)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Stability:</span>
                      <span className={`ml-1 font-semibold ${stdDev < avgTime * 0.2 ? 'text-green-600' : stdDev < avgTime * 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stdDev < avgTime * 0.2 ? 'High' : stdDev < avgTime * 0.4 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={evaluation.results.images.map((img, index) => ({
                  imageNumber: index + 1,
                  apiTime: img.apiDuration || 0
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="imageNumber" 
                    label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    label={{ value: 'API Time (ms)', angle: -90, position: 'insideLeft' }}
                  />
                  <Legend verticalAlign="top" height={24} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      name === 'apiTime' ? `${value}ms` : value,
                      name === 'apiTime' ? 'API Time' : 'Image Number'
                    ]}
                    labelFormatter={(label) => `Image ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="apiTime" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                    name="API Time"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* LLM Output Modal */}
      {showOutput && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">LLM Input/Output</h3>
                <button
                  onClick={() => setShowOutput(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setOutputTab('input')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      outputTab === 'input'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Input
                  </button>
                  <button
                    onClick={() => setOutputTab('output')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      outputTab === 'output'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Output
                  </button>
                </nav>
              </div>
              
              {/* Tab Content */}
              <div className="mt-2">
                {outputTab === 'input' ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">System Prompt & Configuration</h4>
                    <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                      {selectedInput || 'No input data available'}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">LLM Response</h4>
                    <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                      {selectedOutput || 'No response data available'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Information Modal */}
      {showScoreInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Score Calculation Methods</h3>
                <button
                  onClick={() => setShowScoreInfo(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-2 space-y-4">
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-2">Count Score</h4>
                  <p className="text-sm text-gray-700">
                    Measures how accurately the model predicts the total number of objects in the image.
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 ml-4 list-disc">
                    <li>If both actual and predicted counts are 0: 100% accuracy</li>
                    <li>If one is 0 and the other is not: 0% accuracy</li>
                    <li>Otherwise: min(actual, predicted) / max(actual, predicted)</li>
                    <li>Example: 3 actual vs 2 predicted = 2/3 = 66.7%</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-2">Class Score</h4>
                  <p className="text-sm text-gray-700">
                    Measures how accurately the model predicts the class distribution of objects.
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 ml-4 list-disc">
                    <li>Counts instances of each class in both actual and predicted arrays</li>
                    <li>For each class: correct = min(actual_count, predicted_count)</li>
                    <li>Total accuracy = sum(correct) / sum(actual_instances)</li>
                    <li>Example: Actual [0,1,1] vs Predicted [0,1,1] = 3/3 = 100%</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Modals */}
      {expandedChart === 'countAccuracyByImage' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Accuracy by Image"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={evaluation.results?.images.map((img, index) => ({
                imageNumber: index + 1,
                accuracy: (img.score?.countAccuracy || 0) * 100
              })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="imageNumber" 
                  label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend verticalAlign="top" height={24} />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'accuracy' ? `${value}%` : value,
                    name === 'accuracy' ? 'Count Accuracy' : 'Image Number'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return `Image ${label}`;
                  }}
                />
                <Scatter 
                  dataKey="accuracy" 
                  fill="#3B82F6"
                  r={6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'classAccuracyByImage' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Accuracy by Image"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={evaluation.results?.images.map((img, index) => ({
                imageNumber: index + 1,
                accuracy: (img.score?.classAccuracy || 0) * 100
              })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="imageNumber" 
                  label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend verticalAlign="top" height={24} />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'accuracy' ? `${value}%` : value,
                    name === 'accuracy' ? 'Class Accuracy' : 'Image Number'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return `Image ${label}`;
                  }}
                />
                <Scatter 
                  dataKey="accuracy" 
                  fill="#10B981"
                  r={6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'accuracyByClassId' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Accuracy by Class ID"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const classNames: { [key: number]: string } = {
                  0: "Large Civil Transport",
                  1: "Medium Civil Transport", 
                  2: "Military Bomber",
                  3: "Military Fighter",
                  4: "Military Trainer",
                  5: "Military Transport",
                  6: "Small Civil Transport"
                };

                const classAccuracies: { [key: number]: { correct: number; total: number } } = {};
                
                evaluation.results?.images.forEach(img => {
                  if (img.score && img.actualClasses && img.predictedClasses) {
                    const actualCounts = new Map<number, number>();
                    img.actualClasses.forEach(actualClass => {
                      actualCounts.set(actualClass, (actualCounts.get(actualClass) || 0) + 1);
                    });

                    const predictedCounts = new Map<number, number>();
                    img.predictedClasses.forEach(predictedClass => {
                      predictedCounts.set(predictedClass, (predictedCounts.get(predictedClass) || 0) + 1);
                    });

                    actualCounts.forEach((actualCount, classId) => {
                      if (!classAccuracies[classId]) {
                        classAccuracies[classId] = { correct: 0, total: 0 };
                      }
                      
                      const predictedCount = predictedCounts.get(classId) || 0;
                      const correctCount = Math.min(actualCount, predictedCount);
                      
                      classAccuracies[classId].correct += correctCount;
                      classAccuracies[classId].total += actualCount;
                    });
                  }
                });

                // Include all classes that appear in the dataset, even those with 0% accuracy
                const allClassIds = new Set<number>();
                evaluation.results?.images.forEach(img => {
                  if (img.actualClasses) {
                    img.actualClasses.forEach(classId => allClassIds.add(classId));
                  }
                  if (img.predictedClasses) {
                    img.predictedClasses.forEach(classId => allClassIds.add(classId));
                  }
                });

                return Array.from(allClassIds).map(classId => {
                  const stats = classAccuracies[classId] || { correct: 0, total: 0 };
                  return {
                    classId: `${classId} - ${classNames[classId] || `Class ${classId}`}`,
                    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
                    correct: stats.correct,
                    total: stats.total
                  };
                }).sort((a, b) => b.accuracy - a.accuracy);
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="classId" 
                  angle={-45} 
                  textAnchor="end" 
                  height={140}
                  label={{ value: 'Class ID', position: 'insideBottom', offset: -15 }}
                  interval={0}
                />
                <YAxis domain={[0, 100]} label={{ value: 'Percent', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'accuracy' ? `${value.toFixed(1)}%` : value,
                    name === 'accuracy' ? 'Accuracy' : name === 'correct' ? 'Correct' : 'Total'
                  ]}
                />
                <Bar 
                  dataKey="accuracy" 
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'apiTimePerImage' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="API Time per Image"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evaluation.results?.images.map((img, index) => ({
                imageNumber: index + 1,
                apiTime: img.apiDuration || 0
              })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="imageNumber" 
                  label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'API Time (ms)', angle: -90, position: 'insideLeft' }}
                />
                <Legend verticalAlign="top" height={24} />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'apiTime' ? `${value}ms` : value,
                    name === 'apiTime' ? 'API Time' : 'Image Number'
                  ]}
                  labelFormatter={(label) => `Image ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="apiTime" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                  name="API Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'countAccuracyDistribution' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Accuracy Distribution"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const countAccuracies = evaluation.results?.images
                  .map(img => img.score?.countAccuracy || 0)
                  .filter(acc => acc > 0 && !isNaN(acc) && isFinite(acc)) || [];
                return createHistogramData(countAccuracies, 8);
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="range" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  label={{ value: 'Accuracy Range (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Number of Images', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'count' ? value : `${value}%`,
                    name === 'count' ? 'Count' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'classAccuracyDistribution' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Accuracy Distribution"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const classAccuracies = evaluation.results?.images
                  .map(img => img.score?.classAccuracy || 0)
                  .filter(acc => acc > 0 && !isNaN(acc) && isFinite(acc)) || [];
                return createHistogramData(classAccuracies, 8);
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="range" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  label={{ value: 'Accuracy Range (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Number of Images', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'count' ? value : `${value}%`,
                    name === 'count' ? 'Count' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'objectCountVsCountAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Object Count vs Count Accuracy"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={evaluation.results?.images.map((img, index) => ({
                actualObjects: img.actualObjects,
                countAccuracy: (img.score?.countAccuracy || 0) * 100,
                imageNumber: index + 1
              })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="actualObjects" 
                  label={{ value: 'Number of Actual Objects', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'countAccuracy' ? `${value}%` : value,
                    name === 'countAccuracy' ? 'Count Accuracy' : name === 'actualObjects' ? 'Actual Objects' : 'Image Number'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return '';
                  }}
                />
                <Scatter 
                  dataKey="countAccuracy" 
                  fill="#3B82F6"
                  r={6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'objectCountVsClassAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Object Count vs Class Accuracy"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={evaluation.results?.images.map((img, index) => ({
                actualObjects: img.actualObjects,
                classAccuracy: (img.score?.classAccuracy || 0) * 100,
                imageNumber: index + 1
              })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="actualObjects" 
                  label={{ value: 'Number of Actual Objects', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'classAccuracy' ? `${value}%` : value,
                    name === 'classAccuracy' ? 'Class Accuracy' : name === 'actualObjects' ? 'Actual Objects' : 'Image Number'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return '';
                  }}
                />
                <Scatter 
                  dataKey="classAccuracy" 
                  fill="#10B981"
                  r={6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'countConfidenceVsAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Confidence vs Accuracy"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={evaluation.results?.images.map((img, index) => ({
                confidence: img.predictedCountConfidence ? img.predictedCountConfidence * 100 : 0,
                accuracy: (img.score?.countAccuracy || 0) * 100,
                imageNumber: index + 1
              })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="confidence" 
                  domain={[0, 100]}
                  label={{ value: 'Count Confidence (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  type="number"
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'confidence' || name === 'accuracy' ? `${value}%` : value,
                    name === 'confidence' ? 'Count Confidence' : name === 'accuracy' ? 'Count Accuracy' : 'Image Number'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return '';
                  }}
                />
                <Scatter 
                  dataKey="accuracy" 
                  fill="#3B82F6"
                  r={6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {expandedChart === 'classConfidenceVsAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Confidence vs Accuracy"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={evaluation.results?.images.map((img, index) => {
                // Calculate average class confidence for this image
                const avgClassConfidence = img.predictedClassConfidences && img.predictedClassConfidences.length > 0
                  ? img.predictedClassConfidences.reduce((sum, conf) => sum + conf, 0) / img.predictedClassConfidences.length
                  : 0;
                
                return {
                  confidence: avgClassConfidence * 100,
                  accuracy: (img.score?.classAccuracy || 0) * 100,
                  imageNumber: index + 1
                };
              }) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="confidence" 
                  domain={[0, 100]}
                  label={{ value: 'Class Confidence (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  type="number"
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    name === 'confidence' || name === 'accuracy' ? `${value}%` : value,
                    name === 'confidence' ? 'Class Confidence' : name === 'accuracy' ? 'Class Accuracy' : 'Image Number'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return '';
                  }}
                />
                <Scatter 
                  dataKey="accuracy" 
                  fill="#10B981"
                  r={6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}
    </div>
  );
};

export default ModelEvaluationContent;