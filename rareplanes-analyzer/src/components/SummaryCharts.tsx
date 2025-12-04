import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { EvaluationImage, EvaluationResult } from '../services/evalService';

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
}

interface SummaryChartsProps {
  completedEvaluations: ModelEvaluation[];
  getModelColor: (index: number) => string;
  setExpandedChart: (chart: string | null) => void;
  calculateStandardDeviation: (values: number[]) => number;
  calculateVariance: (values: number[]) => number;
  calculateStability: (stdDev: number) => string;
}

export const renderCountAccuracyStdDevChart = ({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation }: SummaryChartsProps) => {
  const chartData = completedEvaluations.map((evaluation, index) => {
    const results = evaluation.results!;
    const countAccuracies = results.images
      .filter(img => img.status === 'completed')
      .map(img => img.score?.countAccuracy || 0);
    
    const stdDev = calculateStandardDeviation(countAccuracies);

    return {
      model: evaluation.model.name,
      stdDev: stdDev * 100,
      color: getModelColor(index)
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Count Accuracy Standard Deviation by Model</h3>
        <button
          onClick={() => setExpandedChart('summaryCountAccuracyStdDev')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Expand
        </button>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="model" 
              label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Standard Deviation (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any) => [`${value.toFixed(2)}%`, 'Std Dev']}
              labelFormatter={(label) => `Model: ${label}`}
            />
            <Bar 
              dataKey="stdDev" 
              fill="#F59E0B"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const renderClassAccuracyStdDevChart = ({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation }: SummaryChartsProps) => {
  const chartData = completedEvaluations.map((evaluation, index) => {
    const results = evaluation.results!;
    const classAccuracies = results.images
      .filter(img => img.status === 'completed')
      .map(img => img.score?.classAccuracy || 0);
    
    const stdDev = calculateStandardDeviation(classAccuracies);

    return {
      model: evaluation.model.name,
      stdDev: stdDev * 100,
      color: getModelColor(index)
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Class Accuracy Standard Deviation by Model</h3>
        <button
          onClick={() => setExpandedChart('summaryClassAccuracyStdDev')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Expand
        </button>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="model" 
              label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Standard Deviation (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any) => [`${value.toFixed(2)}%`, 'Std Dev']}
              labelFormatter={(label) => `Model: ${label}`}
            />
            <Bar 
              dataKey="stdDev" 
              fill="#EF4444"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const renderCountAccuracyVarianceChart = ({ completedEvaluations, getModelColor, setExpandedChart, calculateVariance }: SummaryChartsProps) => {
  const chartData = completedEvaluations.map((evaluation, index) => {
    const results = evaluation.results!;
    const countAccuracies = results.images
      .filter(img => img.status === 'completed')
      .map(img => img.score?.countAccuracy || 0);
    
    const variance = calculateVariance(countAccuracies);

    return {
      model: evaluation.model.name,
      variance: variance * 10000, // Scale for better visualization
      color: getModelColor(index)
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Count Accuracy Variance by Model</h3>
        <button
          onClick={() => setExpandedChart('summaryCountAccuracyVariance')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Expand
        </button>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="model" 
              label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Variance (×10⁴)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any) => [`${value.toFixed(2)}`, 'Variance (×10⁴)']}
              labelFormatter={(label) => `Model: ${label}`}
            />
            <Bar 
              dataKey="variance" 
              fill="#8B5CF6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const renderClassAccuracyVarianceChart = ({ completedEvaluations, getModelColor, setExpandedChart, calculateVariance }: SummaryChartsProps) => {
  const chartData = completedEvaluations.map((evaluation, index) => {
    const results = evaluation.results!;
    const classAccuracies = results.images
      .filter(img => img.status === 'completed')
      .map(img => img.score?.classAccuracy || 0);
    
    const variance = calculateVariance(classAccuracies);

    return {
      model: evaluation.model.name,
      variance: variance * 10000, // Scale for better visualization
      color: getModelColor(index)
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Class Accuracy Variance by Model</h3>
        <button
          onClick={() => setExpandedChart('summaryClassAccuracyVariance')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Expand
        </button>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="model" 
              label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Variance (×10⁴)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any) => [`${value.toFixed(2)}`, 'Variance (×10⁴)']}
              labelFormatter={(label) => `Model: ${label}`}
            />
            <Bar 
              dataKey="variance" 
              fill="#06B6D4"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const renderCountAccuracyStabilityChart = ({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateStability }: SummaryChartsProps) => {
  const chartData = completedEvaluations.map((evaluation, index) => {
    const results = evaluation.results!;
    const countAccuracies = results.images
      .filter(img => img.status === 'completed')
      .map(img => img.score?.countAccuracy || 0);
    
    const stdDev = calculateStandardDeviation(countAccuracies);
    const stability = calculateStability(stdDev);

    // Convert stability to numeric value for charting
    const stabilityValue = stability === 'Excellent' ? 4 : 
                         stability === 'Good' ? 3 : 
                         stability === 'Fair' ? 2 : 1;

    return {
      model: evaluation.model.name,
      stability: stabilityValue,
      stabilityLabel: stability,
      color: getModelColor(index)
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Count Accuracy Stability by Model</h3>
        <button
          onClick={() => setExpandedChart('summaryCountAccuracyStability')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Expand
        </button>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="model" 
              label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[0, 5]}
              label={{ value: 'Stability Rating', angle: -90, position: 'insideLeft' }}
              tickFormatter={(value) => {
                const labels = ['', 'Poor', 'Fair', 'Good', 'Excellent'];
                return labels[value] || '';
              }}
            />
            <Tooltip 
              formatter={(value: any, name: string, props: any) => [
                props.payload.stabilityLabel,
                'Stability'
              ]}
              labelFormatter={(label) => `Model: ${label}`}
            />
            <Bar 
              dataKey="stability" 
              fill="#84CC16"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const renderClassAccuracyStabilityChart = ({ completedEvaluations, getModelColor, setExpandedChart, calculateStandardDeviation, calculateStability }: SummaryChartsProps) => {
  const chartData = completedEvaluations.map((evaluation, index) => {
    const results = evaluation.results!;
    const classAccuracies = results.images
      .filter(img => img.status === 'completed')
      .map(img => img.score?.classAccuracy || 0);
    
    const stdDev = calculateStandardDeviation(classAccuracies);
    const stability = calculateStability(stdDev);

    // Convert stability to numeric value for charting
    const stabilityValue = stability === 'Excellent' ? 4 : 
                         stability === 'Good' ? 3 : 
                         stability === 'Fair' ? 2 : 1;

    return {
      model: evaluation.model.name,
      stability: stabilityValue,
      stabilityLabel: stability,
      color: getModelColor(index)
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Class Accuracy Stability by Model</h3>
        <button
          onClick={() => setExpandedChart('summaryClassAccuracyStability')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Expand
        </button>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="model" 
              label={{ value: 'Model', position: 'insideBottom', offset: -10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[0, 5]}
              label={{ value: 'Stability Rating', angle: -90, position: 'insideLeft' }}
              tickFormatter={(value) => {
                const labels = ['', 'Poor', 'Fair', 'Good', 'Excellent'];
                return labels[value] || '';
              }}
            />
            <Tooltip 
              formatter={(value: any, name: string, props: any) => [
                props.payload.stabilityLabel,
                'Stability'
              ]}
              labelFormatter={(label) => `Model: ${label}`}
            />
            <Bar 
              dataKey="stability" 
              fill="#F97316"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
