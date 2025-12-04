import React, { useState } from 'react';
import { EvaluationImage, EvaluationResult } from '../services/evalService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, LineChart, Line } from 'recharts';
import ChartModal from './ChartModal';
import { 
  renderCountAccuracyStdDevChart, 
  renderClassAccuracyStdDevChart, 
  renderCountAccuracyVarianceChart, 
  renderClassAccuracyVarianceChart, 
  renderCountAccuracyStabilityChart, 
  renderClassAccuracyStabilityChart 
} from './SummaryCharts';

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
  currentImageIndex: number;
  progress: number;
}

interface SummaryAnalysisContentProps {
  modelEvaluations: Record<string, ModelEvaluation>;
  selectedModels: SelectedModel[];
  onDownloadAllResults: () => void;
  calculateEstimatedCost: (modelId: string, sampleSize: number) => number;
  expandedChart: string | null;
  setExpandedChart: (chart: string | null) => void;
}

const SummaryAnalysisContent: React.FC<SummaryAnalysisContentProps> = ({
  modelEvaluations,
  selectedModels,
  onDownloadAllResults,
  calculateEstimatedCost,
  expandedChart,
  setExpandedChart
}) => {
  const [selectedChartType, setSelectedChartType] = useState<string>('countAccuracyByImage');
  
  const completedEvaluations = Object.values(modelEvaluations).filter(evaluation => evaluation.results !== null);

  // Chart type options matching individual model tabs
  const chartTypes = [
    { value: 'countAccuracyByImage', label: 'Count Accuracy by Image' },
    { value: 'classAccuracyByImage', label: 'Class Accuracy by Image' },
    { value: 'countAccuracyDistribution', label: 'Count Accuracy Distribution' },
    { value: 'classAccuracyDistribution', label: 'Class Accuracy Distribution' },
    { value: 'objectCountVsCountAccuracy', label: 'Object Count vs Count Accuracy' },
    { value: 'objectCountVsClassAccuracy', label: 'Object Count vs Class Accuracy' },
    { value: 'countConfidenceVsAccuracy', label: 'Count Confidence vs Accuracy' },
    { value: 'classConfidenceVsAccuracy', label: 'Class Confidence vs Accuracy' },
    { value: 'accuracyByClassId', label: 'Accuracy by Class ID' },
    { value: 'apiTimePerImage', label: 'API Time per Image' },
    { value: 'countAccuracyByModel', label: 'Count Accuracy by Model' },
    { value: 'classAccuracyByModel', label: 'Class Accuracy by Model' },
    { value: 'countAccuracyStdDev', label: 'Count Accuracy Std Dev by Model' },
    { value: 'classAccuracyStdDev', label: 'Class Accuracy Std Dev by Model' },
    { value: 'countAccuracyVariance', label: 'Count Accuracy Variance by Model' },
    { value: 'classAccuracyVariance', label: 'Class Accuracy Variance by Model' },
    { value: 'countAccuracyStability', label: 'Count Accuracy Stability by Model' },
    { value: 'classAccuracyStability', label: 'Class Accuracy Stability by Model' }
  ];

  // Generate colors for each model
  const getModelColor = (index: number) => {
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316', // Orange
      '#EC4899', // Pink
      '#6B7280'  // Gray
    ];
    return colors[index % colors.length];
  };

  // Helper function to create histogram data (same as individual model pages)
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
    const binSize = (max - min) / bins;
    
    const histogram = Array(bins).fill(0).map((_, i) => ({
      range: `${(min + i * binSize).toFixed(0)}-${(min + (i + 1) * binSize).toFixed(0)}%`,
      count: 0,
      percentage: 0
    }));
    
    validValues.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
      histogram[binIndex].count++;
    });
    
    // Calculate percentages
    histogram.forEach(bin => {
      bin.percentage = (bin.count / validValues.length) * 100;
    });
    
    return histogram;
  };

  // Helper functions for statistical calculations
  const calculateMean = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const calculateStandardDeviation = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const calculateVariance = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = calculateMean(values);
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  };

  const calculateStability = (stdDev: number): string => {
    if (stdDev <= 0.1) return 'Excellent';
    if (stdDev <= 0.2) return 'Good';
    if (stdDev <= 0.3) return 'Fair';
    return 'Poor';
  };

  // Count Accuracy by Model Chart
  const renderCountAccuracyByModelChart = () => {
    const chartData = completedEvaluations.map((evaluation, index) => {
      const results = evaluation.results!;
      const countAccuracies = results.images
        .filter(img => img.status === 'completed')
        .map(img => img.score?.countAccuracy || 0);
      
      const avgAccuracy = countAccuracies.length > 0 
        ? countAccuracies.reduce((sum, acc) => sum + acc, 0) / countAccuracies.length 
        : 0;

      return {
        model: evaluation.model.name,
        accuracy: avgAccuracy * 100,
        fill: getModelColor(index)
      };
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Count Accuracy by Model</h3>
          <button
            onClick={() => setExpandedChart('summaryCountAccuracyByModel')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="model" 
                label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
                angle={-45}
                textAnchor="end"
                height={120}
              />
              <YAxis 
                domain={[0, 100]} 
                label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: any) => [`${value.toFixed(1)}%`, 'Count Accuracy']}
                labelFormatter={(label) => `Model: ${label}`}
              />
              <Bar 
                dataKey="accuracy" 
                radius={[4, 4, 0, 0]}
                label={{ position: 'top', formatter: (value: any) => `${value.toFixed(2)}%` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Class Accuracy by Model Chart
  const renderClassAccuracyByModelChart = () => {
    const chartData = completedEvaluations.map((evaluation, index) => {
      const results = evaluation.results!;
      const classAccuracies = results.images
        .filter(img => img.status === 'completed')
        .map(img => img.score?.classAccuracy || 0);
      
      const avgAccuracy = classAccuracies.length > 0 
        ? classAccuracies.reduce((sum, acc) => sum + acc, 0) / classAccuracies.length 
        : 0;

      return {
        model: evaluation.model.name,
        accuracy: avgAccuracy * 100,
        fill: getModelColor(index)
      };
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Class Accuracy by Model</h3>
          <button
            onClick={() => setExpandedChart('summaryClassAccuracyByModel')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="model" 
                label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
                angle={-45}
                textAnchor="end"
                height={120}
              />
              <YAxis 
                domain={[0, 100]} 
                label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: any) => [`${value.toFixed(1)}%`, 'Class Accuracy']}
                labelFormatter={(label) => `Model: ${label}`}
              />
              <Bar 
                dataKey="accuracy" 
                radius={[4, 4, 0, 0]}
                label={{ position: 'top', formatter: (value: any) => `${value.toFixed(2)}%` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Render the selected chart type
  const renderSelectedChart = () => {
    if (completedEvaluations.length === 0) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No completed evaluations to display charts.</p>
        </div>
      );
    }

    switch (selectedChartType) {
      case 'countAccuracyByImage':
        return renderCountAccuracyByImageChart();
      case 'classAccuracyByImage':
        return renderClassAccuracyByImageChart();
      case 'countAccuracyDistribution':
        return renderCountAccuracyDistributionChart();
      case 'classAccuracyDistribution':
        return renderClassAccuracyDistributionChart();
      case 'objectCountVsCountAccuracy':
        return renderObjectCountVsCountAccuracyChart();
      case 'objectCountVsClassAccuracy':
        return renderObjectCountVsClassAccuracyChart();
      case 'countConfidenceVsAccuracy':
        return renderCountConfidenceVsAccuracyChart();
      case 'classConfidenceVsAccuracy':
        return renderClassConfidenceVsAccuracyChart();
      case 'accuracyByClassId':
        return renderAccuracyByClassIdChart();
      case 'apiTimePerImage':
        return renderApiTimePerImageChart();
      case 'countAccuracyByModel':
        return renderCountAccuracyByModelChart();
      case 'classAccuracyByModel':
        return renderClassAccuracyByModelChart();
      case 'countAccuracyStdDev':
        return renderCountAccuracyStdDevChart({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateVariance, calculateStability });
      case 'classAccuracyStdDev':
        return renderClassAccuracyStdDevChart({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateVariance, calculateStability });
      case 'countAccuracyVariance':
        return renderCountAccuracyVarianceChart({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateVariance, calculateStability });
      case 'classAccuracyVariance':
        return renderClassAccuracyVarianceChart({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateVariance, calculateStability });
      case 'countAccuracyStability':
        return renderCountAccuracyStabilityChart({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateVariance, calculateStability });
      case 'classAccuracyStability':
        return renderClassAccuracyStabilityChart({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateVariance, calculateStability });
      default:
        return renderCountAccuracyByImageChart();
    }
  };

  // Count Accuracy by Image Chart
  const renderCountAccuracyByImageChart = () => {
    const maxImages = Math.max(...completedEvaluations.map(e => e.results!.images.length));
    const chartData = Array.from({ length: maxImages }, (_, index) => {
      const dataPoint: any = { imageNumber: index + 1 };
      completedEvaluations.forEach((evaluation, modelIndex) => {
        const image = evaluation.results!.images[index];
        if (image && image.status === 'completed') {
          dataPoint[evaluation.model.name] = (image.score?.countAccuracy || 0) * 100;
        }
      });
      return dataPoint;
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Count Accuracy by Image - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryCountAccuracyByImage')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="imageNumber" 
                label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                domain={[0, 100]} 
                label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value.toFixed(1)}%`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Image ${payload[0].payload.imageNumber}`;
                  }
                  return `Image ${label}`;
                }}
              />
              {completedEvaluations.map((evaluation, index) => (
                <Scatter
                  key={evaluation.model.id}
                  dataKey={evaluation.model.name}
                  fill={getModelColor(index)}
                  r={4}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Class Accuracy by Image Chart
  const renderClassAccuracyByImageChart = () => {
    const maxImages = Math.max(...completedEvaluations.map(e => e.results!.images.length));
    const chartData = Array.from({ length: maxImages }, (_, index) => {
      const dataPoint: any = { imageNumber: index + 1 };
      completedEvaluations.forEach((evaluation, modelIndex) => {
        const image = evaluation.results!.images[index];
        if (image && image.status === 'completed') {
          dataPoint[evaluation.model.name] = (image.score?.classAccuracy || 0) * 100;
        }
      });
      return dataPoint;
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Class Accuracy by Image - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryClassAccuracyByImage')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="imageNumber" 
                label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                domain={[0, 100]} 
                label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value.toFixed(1)}%`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Image ${payload[0].payload.imageNumber}`;
                  }
                  return `Image ${label}`;
                }}
              />
              {completedEvaluations.map((evaluation, index) => (
                <Scatter
                  key={evaluation.model.id}
                  dataKey={evaluation.model.name}
                  fill={getModelColor(index)}
                  r={4}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Object Count vs Count Accuracy Chart
  const renderObjectCountVsCountAccuracyChart = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Object Count vs Count Accuracy - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryObjectCountVsCountAccuracy')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                dataKey="actualObjects" 
                label={{ value: 'Actual Object Count', position: 'insideBottom', offset: -10 }}
                domain={['dataMin', 'dataMax']}
              />
              <YAxis 
                type="number"
                domain={[0, 100]} 
                label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value}%`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Objects: ${payload[0].payload.actualObjects}, Model: ${payload[0].payload.model}`;
                  }
                  return `Objects: ${label}`;
                }}
              />
              {completedEvaluations.map((evaluation, index) => {
                const modelData = evaluation.results!.images
                  .filter(img => img.status === 'completed' && img.score)
                  .map(img => ({
                    actualObjects: img.actualObjects,
                    countAccuracy: (img.score!.countAccuracy || 0) * 100,
                    model: evaluation.model.name
                  }));
                
                return (
                  <Scatter
                    key={evaluation.model.id}
                    data={modelData}
                    dataKey="countAccuracy"
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                    r={4}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Count Accuracy Distribution Chart
  const renderCountAccuracyDistributionChart = () => {
    // Create histogram data for each model separately
    const chartData = completedEvaluations.map(evaluation => {
      const countAccuracies = evaluation.results!.images
        .filter(img => img.status === 'completed')
        .map(img => (img.score?.countAccuracy || 0) * 100)
        .filter(acc => acc > 0);
      
      return {
        model: evaluation.model.name,
        histogram: createHistogramData(countAccuracies, 8)
      };
    });

    // Flatten data for multi-bar chart
    const flattenedData: any[] = [];
    const ranges = chartData[0]?.histogram.map(h => h.range) || [];
    
    ranges.forEach(range => {
      const dataPoint: any = { range };
      chartData.forEach((modelData, index) => {
        const binData = modelData.histogram.find(h => h.range === range);
        dataPoint[modelData.model] = binData?.count || 0;
      });
      flattenedData.push(dataPoint);
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Count Accuracy Distribution - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryCountAccuracyDistribution')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flattenedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value} images`,
                  name
                ]}
                labelFormatter={(label) => `Range: ${label}`}
              />
              {completedEvaluations.map((evaluation, index) => (
                <Bar
                  key={evaluation.model.id}
                  dataKey={evaluation.model.name}
                  fill={getModelColor(index)}
                  name={evaluation.model.name}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Class Accuracy Distribution Chart
  const renderClassAccuracyDistributionChart = () => {
    // Create histogram data for each model separately
    const chartData = completedEvaluations.map(evaluation => {
      const classAccuracies = evaluation.results!.images
        .filter(img => img.status === 'completed')
        .map(img => (img.score?.classAccuracy || 0) * 100)
        .filter(acc => acc > 0);
      
      return {
        model: evaluation.model.name,
        histogram: createHistogramData(classAccuracies, 8)
      };
    });

    // Flatten data for multi-bar chart
    const flattenedData: any[] = [];
    const ranges = chartData[0]?.histogram.map(h => h.range) || [];
    
    ranges.forEach(range => {
      const dataPoint: any = { range };
      chartData.forEach((modelData, index) => {
        const binData = modelData.histogram.find(h => h.range === range);
        dataPoint[modelData.model] = binData?.count || 0;
      });
      flattenedData.push(dataPoint);
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Class Accuracy Distribution - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryClassAccuracyDistribution')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flattenedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value} images`,
                  name
                ]}
                labelFormatter={(label) => `Range: ${label}`}
              />
              {completedEvaluations.map((evaluation, index) => (
                <Bar
                  key={evaluation.model.id}
                  dataKey={evaluation.model.name}
                  fill={getModelColor(index)}
                  name={evaluation.model.name}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Object Count vs Class Accuracy Chart
  const renderObjectCountVsClassAccuracyChart = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Object Count vs Class Accuracy - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryObjectCountVsClassAccuracy')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                dataKey="actualObjects" 
                label={{ value: 'Actual Object Count', position: 'insideBottom', offset: -10 }}
                domain={['dataMin', 'dataMax']}
              />
              <YAxis 
                type="number"
                domain={[0, 100]} 
                label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value}%`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Objects: ${payload[0].payload.actualObjects}, Model: ${payload[0].payload.model}`;
                  }
                  return `Objects: ${label}`;
                }}
              />
              {completedEvaluations.map((evaluation, index) => {
                const modelData = evaluation.results!.images
                  .filter(img => img.status === 'completed' && img.score)
                  .map(img => ({
                    actualObjects: img.actualObjects,
                    classAccuracy: (img.score!.classAccuracy || 0) * 100,
                    model: evaluation.model.name
                  }));
                
                return (
                  <Scatter
                    key={evaluation.model.id}
                    data={modelData}
                    dataKey="classAccuracy"
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                    r={4}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Count Confidence vs Accuracy Chart
  const renderCountConfidenceVsAccuracyChart = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Count Confidence vs Accuracy - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryCountConfidenceVsAccuracy')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                dataKey="confidence" 
                label={{ value: 'Count Confidence (%)', position: 'insideBottom', offset: -10 }}
                domain={[0, 100]}
              />
              <YAxis 
                type="number"
                domain={[0, 100]} 
                label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value}%`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Model: ${payload[0].payload.model}`;
                  }
                  return '';
                }}
              />
              {completedEvaluations.map((evaluation, index) => {
                const modelData = evaluation.results!.images
                  .filter(img => img.status === 'completed' && img.score && img.predictedCountConfidence)
                  .map(img => ({
                    confidence: img.predictedCountConfidence! * 100,
                    accuracy: (img.score!.countAccuracy || 0) * 100,
                    model: evaluation.model.name
                  }));
                
                return (
                  <Scatter
                    key={evaluation.model.id}
                    data={modelData}
                    dataKey="accuracy"
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                    r={4}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Class Confidence vs Accuracy Chart
  const renderClassConfidenceVsAccuracyChart = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Class Confidence vs Accuracy - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryClassConfidenceVsAccuracy')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                dataKey="confidence" 
                label={{ value: 'Average Class Confidence (%)', position: 'insideBottom', offset: -10 }}
                domain={[0, 100]}
              />
              <YAxis 
                type="number"
                domain={[0, 100]} 
                label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value}%`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Model: ${payload[0].payload.model}`;
                  }
                  return '';
                }}
              />
              {completedEvaluations.map((evaluation, index) => {
                const modelData = evaluation.results!.images
                  .filter(img => img.status === 'completed' && img.score && img.predictedClassConfidences && img.predictedClassConfidences.length > 0)
                  .map(img => {
                    const avgClassConfidence = img.predictedClassConfidences!.reduce((sum, conf) => sum + conf, 0) / img.predictedClassConfidences!.length;
                    return {
                      confidence: avgClassConfidence * 100,
                      accuracy: (img.score!.classAccuracy || 0) * 100,
                      model: evaluation.model.name
                    };
                  });
                
                return (
                  <Scatter
                    key={evaluation.model.id}
                    data={modelData}
                    dataKey="accuracy"
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                    r={4}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Accuracy by Class ID Chart
  const renderAccuracyByClassIdChart = () => {
    const classNames = {
      0: "Large Civil Transport",
      1: "Medium Civil Transport", 
      2: "Small Civil Transport",
      3: "Large Military Transport",
      4: "Medium Military Transport",
      5: "Small Military Transport",
      6: "Fighter"
    };

    const chartData = Object.keys(classNames).map(classId => {
      const dataPoint: any = { 
        classId: parseInt(classId), 
        className: `${classId} - ${classNames[parseInt(classId) as keyof typeof classNames]}` 
      };
      
      completedEvaluations.forEach((evaluation, index) => {
        const classAccuracies = evaluation.results!.images
          .filter(img => img.status === 'completed' && img.actualClasses.includes(parseInt(classId)))
          .map(img => {
            const actualInstances = img.actualClasses.filter(c => c === parseInt(classId)).length;
            const predictedInstances = img.predictedClasses?.filter(c => c === parseInt(classId)).length || 0;
            return actualInstances > 0 ? Math.min(actualInstances, predictedInstances) / actualInstances : 0;
          });
        
        const avgAccuracy = classAccuracies.length > 0 
          ? classAccuracies.reduce((sum, acc) => sum + acc, 0) / classAccuracies.length 
          : 0;
        
        dataPoint[evaluation.model.name] = avgAccuracy * 100;
      });
      
      return dataPoint;
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Accuracy by Class ID - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryAccuracyByClassId')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="className" 
                label={{ value: 'Class', position: 'insideBottom', offset: -5 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                domain={[0, 100]} 
                label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value.toFixed(1)}%`,
                  name
                ]}
                labelFormatter={(label) => `Class: ${label}`}
              />
              {completedEvaluations.map((evaluation, index) => (
                <Bar
                  key={evaluation.model.id}
                  dataKey={evaluation.model.name}
                  fill={getModelColor(index)}
                  name={evaluation.model.name}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // API Time per Image Chart
  const renderApiTimePerImageChart = () => {
    const maxImages = Math.max(...completedEvaluations.map(e => e.results!.images.length));
    const chartData = Array.from({ length: maxImages }, (_, index) => {
      const dataPoint: any = { imageNumber: index + 1 };
      completedEvaluations.forEach((evaluation, modelIndex) => {
        const image = evaluation.results!.images[index];
        if (image && image.status === 'completed') {
          dataPoint[evaluation.model.name] = image.apiDuration || 0;
        }
      });
      return dataPoint;
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">API Time per Image - Model Comparison</h3>
          <button
            onClick={() => setExpandedChart('summaryApiTimePerImage')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Expand
          </button>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="imageNumber" 
                label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                label={{ value: 'API Time (ms)', angle: -90, position: 'insideLeft' }}
              />
              <Legend 
                verticalAlign="top" 
                height={24} 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value}ms`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `Image ${payload[0].payload.imageNumber}`;
                  }
                  return `Image ${label}`;
                }}
              />
              {completedEvaluations.map((evaluation, index) => (
                <Line
                  key={evaluation.model.id}
                  type="monotone"
                  dataKey={evaluation.model.name}
                  stroke={getModelColor(index)}
                  strokeWidth={2}
                  dot={false}
                  name={evaluation.model.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Summary Statistics
  const summaryStats = completedEvaluations.map(evaluation => {
    const results = evaluation.results!;
    return {
      modelName: evaluation.model.name,
      providerName: evaluation.model.providerName,
      averageCountAccuracy: results.averageCountAccuracy,
      averageClassAccuracy: results.averageClassAccuracy,
      totalCost: results.totalCost,
      duration: results.duration,
      completedImages: results.images.filter(img => img.status === 'completed').length,
      totalImages: results.images.length
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary Statistics Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Summary Analysis</h2>
            <button
              onClick={onDownloadAllResults}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
            >
              Download All Results
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count Accuracy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Accuracy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summaryStats.map((stat, index) => (
                <tr key={stat.modelName}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.modelName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.providerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                    {(stat.averageCountAccuracy * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                    {(stat.averageClassAccuracy * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                    {((stat.duration || 0) / 1000).toFixed(1)}s
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {stat.completedImages}/{stat.totalImages}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Selection Dropdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Chart Analysis</h3>
          <div className="flex items-center space-x-4">
            <label htmlFor="chart-select" className="text-sm font-medium text-gray-700">
              Select Chart Type:
            </label>
            <select
              id="chart-select"
              value={selectedChartType}
              onChange={(e) => setSelectedChartType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {chartTypes.map(chart => (
                <option key={chart.value} value={chart.value}>
                  {chart.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Selected Chart */}
        {renderSelectedChart()}
      </div>

      {/* Expanded Chart Modals */}
      {expandedChart === 'summaryCountAccuracyByImage' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Accuracy by Image - Model Comparison"
        >
          <div className="mb-4 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Chart Height:</label>
            <input
              type="range"
              min="400"
              max="800"
              step="50"
              defaultValue="600"
              onChange={(e) => {
                const height = e.target.value;
                const nextElement = e.target.nextElementSibling as HTMLElement;
                if (nextElement) {
                  nextElement.style.height = `${height}px`;
                }
              }}
              className="w-32"
            />
            <span className="text-sm text-gray-500">600px</span>
          </div>
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={Array.from({ length: Math.max(...completedEvaluations.map(e => e.results!.images.length)) }, (_, index) => {
                const dataPoint: any = { imageNumber: index + 1 };
                completedEvaluations.forEach((evaluation, modelIndex) => {
                  const image = evaluation.results!.images[index];
                  if (image && image.status === 'completed') {
                    dataPoint[evaluation.model.name] = (image.score?.countAccuracy || 0) * 100;
                  }
                });
                return dataPoint;
              })} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="imageNumber" 
                  label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value.toFixed(1)}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return `Image ${label}`;
                  }}
                />
                {completedEvaluations.map((evaluation, index) => (
                  <Scatter
                    key={evaluation.model.id}
                    dataKey={evaluation.model.name}
                    fill={getModelColor(index)}
                    r={4}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Count Accuracy by Model Expanded */}
      {expandedChart === 'summaryCountAccuracyByModel' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Accuracy by Model"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completedEvaluations.map((evaluation, index) => {
                const results = evaluation.results!;
                const countAccuracies = results.images
                  .filter(img => img.status === 'completed')
                  .map(img => img.score?.countAccuracy || 0);
                
                const avgAccuracy = countAccuracies.length > 0 
                  ? countAccuracies.reduce((sum, acc) => sum + acc, 0) / countAccuracies.length 
                  : 0;

                return {
                  model: evaluation.model.name,
                  accuracy: avgAccuracy * 100,
                  fill: getModelColor(index)
                };
              })} margin={{ top: 40, right: 30, left: 20, bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="model" 
                  label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
                  angle={-45}
                  textAnchor="end"
                  height={120}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Count Accuracy']}
                  labelFormatter={(label) => `Model: ${label}`}
                />
                <Bar 
                  dataKey="accuracy" 
                  radius={[4, 4, 0, 0]}
                  label={{ position: 'top', formatter: (value: any) => `${value.toFixed(2)}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Class Accuracy by Model Expanded */}
      {expandedChart === 'summaryClassAccuracyByModel' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Accuracy by Model"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completedEvaluations.map((evaluation, index) => {
                const results = evaluation.results!;
                const classAccuracies = results.images
                  .filter(img => img.status === 'completed')
                  .map(img => img.score?.classAccuracy || 0);
                
                const avgAccuracy = classAccuracies.length > 0 
                  ? classAccuracies.reduce((sum, acc) => sum + acc, 0) / classAccuracies.length 
                  : 0;

                return {
                  model: evaluation.model.name,
                  accuracy: avgAccuracy * 100,
                  fill: getModelColor(index)
                };
              })} margin={{ top: 40, right: 30, left: 20, bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="model" 
                  label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
                  angle={-45}
                  textAnchor="end"
                  height={120}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Class Accuracy']}
                  labelFormatter={(label) => `Model: ${label}`}
                />
                <Bar 
                  dataKey="accuracy" 
                  radius={[4, 4, 0, 0]}
                  label={{ position: 'top', formatter: (value: any) => `${value.toFixed(2)}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Class Accuracy by Image Expanded */}
      {expandedChart === 'summaryClassAccuracyByImage' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Accuracy by Image - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={Array.from({ length: Math.max(...completedEvaluations.map(e => e.results!.images.length)) }, (_, index) => {
                const dataPoint: any = { imageNumber: index + 1 };
                completedEvaluations.forEach((evaluation, modelIndex) => {
                  const image = evaluation.results!.images[index];
                  if (image && image.status === 'completed') {
                    dataPoint[evaluation.model.name] = (image.score?.classAccuracy || 0) * 100;
                  }
                });
                return dataPoint;
              })} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="imageNumber" 
                  label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value.toFixed(1)}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return `Image ${label}`;
                  }}
                />
                {completedEvaluations.map((evaluation, index) => (
                  <Scatter
                    key={evaluation.model.id}
                    dataKey={evaluation.model.name}
                    fill={getModelColor(index)}
                    r={4}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Object Count vs Count Accuracy Expanded */}
      {expandedChart === 'summaryObjectCountVsCountAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Object Count vs Count Accuracy - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="actualObjects" 
                  label={{ value: 'Actual Object Count', position: 'insideBottom', offset: -10 }}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  type="number"
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Objects: ${payload[0].payload.actualObjects}, Model: ${payload[0].payload.model}`;
                    }
                    return `Objects: ${label}`;
                  }}
                />
                {completedEvaluations.map((evaluation, index) => {
                  const modelData = evaluation.results!.images
                    .filter(img => img.status === 'completed' && img.score)
                    .map(img => ({
                      actualObjects: img.actualObjects,
                      countAccuracy: (img.score!.countAccuracy || 0) * 100,
                      model: evaluation.model.name
                    }));
                  
                  return (
                    <Scatter
                      key={evaluation.model.id}
                      data={modelData}
                      dataKey="countAccuracy"
                      fill={getModelColor(index)}
                      name={evaluation.model.name}
                      r={4}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Count Accuracy Distribution Expanded */}
      {expandedChart === 'summaryCountAccuracyDistribution' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Accuracy Distribution - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                // Create histogram data for each model separately
                const chartData = completedEvaluations.map(evaluation => {
                  const countAccuracies = evaluation.results!.images
                    .filter(img => img.status === 'completed')
                    .map(img => (img.score?.countAccuracy || 0) * 100)
                    .filter(acc => acc > 0);
                  
                  return {
                    model: evaluation.model.name,
                    histogram: createHistogramData(countAccuracies, 8)
                  };
                });

                // Flatten data for multi-bar chart
                const flattenedData: any[] = [];
                const ranges = chartData[0]?.histogram.map(h => h.range) || [];
                
                ranges.forEach(range => {
                  const dataPoint: any = { range };
                  chartData.forEach((modelData, index) => {
                    const binData = modelData.histogram.find(h => h.range === range);
                    dataPoint[modelData.model] = binData?.count || 0;
                  });
                  flattenedData.push(dataPoint);
                });

                return flattenedData;
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="range" 
                  label={{ value: 'Accuracy Range (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Number of Images', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value} images`,
                    name
                  ]}
                  labelFormatter={(label) => `Range: ${label}`}
                />
                {completedEvaluations.map((evaluation, index) => (
                  <Bar
                    key={evaluation.model.id}
                    dataKey={evaluation.model.name}
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Class Accuracy Distribution Expanded */}
      {expandedChart === 'summaryClassAccuracyDistribution' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Accuracy Distribution - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                // Create histogram data for each model separately
                const chartData = completedEvaluations.map(evaluation => {
                  const classAccuracies = evaluation.results!.images
                    .filter(img => img.status === 'completed')
                    .map(img => (img.score?.classAccuracy || 0) * 100)
                    .filter(acc => acc > 0);
                  
                  return {
                    model: evaluation.model.name,
                    histogram: createHistogramData(classAccuracies, 8)
                  };
                });

                // Flatten data for multi-bar chart
                const flattenedData: any[] = [];
                const ranges = chartData[0]?.histogram.map(h => h.range) || [];
                
                ranges.forEach(range => {
                  const dataPoint: any = { range };
                  chartData.forEach((modelData, index) => {
                    const binData = modelData.histogram.find(h => h.range === range);
                    dataPoint[modelData.model] = binData?.count || 0;
                  });
                  flattenedData.push(dataPoint);
                });

                return flattenedData;
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="range" 
                  label={{ value: 'Accuracy Range (%)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Number of Images', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value} images`,
                    name
                  ]}
                  labelFormatter={(label) => `Range: ${label}`}
                />
                {completedEvaluations.map((evaluation, index) => (
                  <Bar
                    key={evaluation.model.id}
                    dataKey={evaluation.model.name}
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Object Count vs Class Accuracy Expanded */}
      {expandedChart === 'summaryObjectCountVsClassAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Object Count vs Class Accuracy - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="actualObjects" 
                  label={{ value: 'Actual Object Count', position: 'insideBottom', offset: -10 }}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  type="number"
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Objects: ${payload[0].payload.actualObjects}, Model: ${payload[0].payload.model}`;
                    }
                    return `Objects: ${label}`;
                  }}
                />
                {completedEvaluations.map((evaluation, index) => {
                  const modelData = evaluation.results!.images
                    .filter(img => img.status === 'completed' && img.score)
                    .map(img => ({
                      actualObjects: img.actualObjects,
                      classAccuracy: (img.score!.classAccuracy || 0) * 100,
                      model: evaluation.model.name
                    }));
                  
                  return (
                    <Scatter
                      key={evaluation.model.id}
                      data={modelData}
                      dataKey="classAccuracy"
                      fill={getModelColor(index)}
                      name={evaluation.model.name}
                      r={4}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Count Confidence vs Accuracy Expanded */}
      {expandedChart === 'summaryCountConfidenceVsAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Count Confidence vs Accuracy - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="confidence" 
                  label={{ value: 'Count Confidence (%)', position: 'insideBottom', offset: -10 }}
                  domain={[0, 100]}
                />
                <YAxis 
                  type="number"
                  domain={[0, 100]} 
                  label={{ value: 'Count Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Model: ${payload[0].payload.model}`;
                    }
                    return '';
                  }}
                />
                {completedEvaluations.map((evaluation, index) => {
                  const modelData = evaluation.results!.images
                    .filter(img => img.status === 'completed' && img.score && img.predictedCountConfidence)
                    .map(img => ({
                      confidence: img.predictedCountConfidence! * 100,
                      accuracy: (img.score!.countAccuracy || 0) * 100,
                      model: evaluation.model.name
                    }));
                  
                  return (
                    <Scatter
                      key={evaluation.model.id}
                      data={modelData}
                      dataKey="accuracy"
                      fill={getModelColor(index)}
                      name={evaluation.model.name}
                      r={4}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Class Confidence vs Accuracy Expanded */}
      {expandedChart === 'summaryClassConfidenceVsAccuracy' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Class Confidence vs Accuracy - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="confidence" 
                  label={{ value: 'Average Class Confidence (%)', position: 'insideBottom', offset: -10 }}
                  domain={[0, 100]}
                />
                <YAxis 
                  type="number"
                  domain={[0, 100]} 
                  label={{ value: 'Class Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Model: ${payload[0].payload.model}`;
                    }
                    return '';
                  }}
                />
                {completedEvaluations.map((evaluation, index) => {
                  const modelData = evaluation.results!.images
                    .filter(img => img.status === 'completed' && img.score && img.predictedClassConfidences && img.predictedClassConfidences.length > 0)
                    .map(img => {
                      const avgClassConfidence = img.predictedClassConfidences!.reduce((sum, conf) => sum + conf, 0) / img.predictedClassConfidences!.length;
                      return {
                        confidence: avgClassConfidence * 100,
                        accuracy: (img.score!.classAccuracy || 0) * 100,
                        model: evaluation.model.name
                      };
                    });
                  
                  return (
                    <Scatter
                      key={evaluation.model.id}
                      data={modelData}
                      dataKey="accuracy"
                      fill={getModelColor(index)}
                      name={evaluation.model.name}
                      r={4}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* Accuracy by Class ID Expanded */}
      {expandedChart === 'summaryAccuracyByClassId' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="Accuracy by Class ID - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Array.from({ length: 7 }, (_, i) => {
                const dataPoint: any = { classId: `${i}` };
                
                completedEvaluations.forEach((evaluation) => {
                  const results = evaluation.results!;
                  const classAccuracies: { [key: string]: number[] } = {};
                  
                  results.images
                    .filter(img => img.status === 'completed' && img.score)
                    .forEach(img => {
                      img.actualClasses.forEach(classId => {
                        if (!classAccuracies[classId]) {
                          classAccuracies[classId] = [];
                        }
                        classAccuracies[classId].push(img.score!.classAccuracy || 0);
                      });
                    });
                  
                  const accuracies = classAccuracies[i] || [];
                  const avgAccuracy = accuracies.length > 0 
                    ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length * 100
                    : 0;
                  
                  dataPoint[evaluation.model.name] = avgAccuracy;
                });
                
                return dataPoint;
              })} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="classId" 
                  label={{ value: 'Class ID', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value.toFixed(1)}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const classNames = {
                        0: "Large Civil Transport",
                        1: "Medium Civil Transport", 
                        2: "Military Bomber",
                        3: "Military Fighter",
                        4: "Military Trainer",
                        5: "Military Transport",
                        6: "Small Civil Transport"
                      };
                      return `${classNames[parseInt(payload[0].payload.classId) as keyof typeof classNames]} (${payload[0].payload.classId})`;
                    }
                    return `Class ${label}`;
                  }}
                />
                {completedEvaluations.map((evaluation, index) => (
                  <Bar
                    key={evaluation.model.id}
                    dataKey={evaluation.model.name}
                    fill={getModelColor(index)}
                    name={evaluation.model.name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}

      {/* API Time per Image Expanded */}
      {expandedChart === 'summaryApiTimePerImage' && (
        <ChartModal
          isOpen={true}
          onClose={() => setExpandedChart(null)}
          title="API Time per Image - Model Comparison"
        >
          <div className="h-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={Array.from({ length: Math.max(...completedEvaluations.map(e => e.results!.images.length)) }, (_, index) => {
                const dataPoint: any = { imageNumber: index + 1 };
                completedEvaluations.forEach((evaluation, modelIndex) => {
                  const image = evaluation.results!.images[index];
                  if (image && image.status === 'completed') {
                    dataPoint[evaluation.model.name] = image.apiDuration || 0;
                  }
                });
                return dataPoint;
              })} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="imageNumber" 
                  label={{ value: 'Number of Images', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'API Time (ms)', angle: -90, position: 'insideLeft' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={24} 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value}ms`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Image ${payload[0].payload.imageNumber}`;
                    }
                    return `Image ${label}`;
                  }}
                />
                {completedEvaluations.map((evaluation, index) => (
                  <Line
                    key={evaluation.model.id}
                    type="monotone"
                    dataKey={evaluation.model.name}
                    stroke={getModelColor(index)}
                    strokeWidth={2}
                    dot={false}
                    name={evaluation.model.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartModal>
      )}
    </div>
  );

};

export default SummaryAnalysisContent;