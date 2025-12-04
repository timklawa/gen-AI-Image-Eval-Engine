import React, { useState, useRef, useEffect } from 'react';
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
  currentImageIndex: number;
  progress: number;
}

interface EvaluationTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedModels: SelectedModel[];
  modelEvaluations: Record<string, ModelEvaluation>;
  children: React.ReactNode;
}

const EvaluationTabs: React.FC<EvaluationTabsProps> = ({
  activeTab,
  onTabChange,
  selectedModels,
  modelEvaluations,
  children
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const checkScrollButtons = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const handleResize = () => checkScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedModels]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      const newScrollPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      tabsRef.current.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      });
      setScrollPosition(newScrollPosition);
    }
  };
  const getTabStatus = (modelId: string) => {
    const evaluation = modelEvaluations[modelId];
    if (!evaluation) return 'pending';
    
    if (evaluation.results) return 'completed';
    if (evaluation.progress > 0) return 'running';
    return 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 relative">
        <div className="flex items-center">
          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-0 z-10 bg-white border-r border-gray-200 px-3 py-4 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-0 z-10 bg-white border-l border-gray-200 px-3 py-4 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          
          {/* Scrollable Tabs Container */}
          <div 
            ref={tabsRef}
            className="flex space-x-8 px-6 overflow-x-auto scrollbar-hide"
            onScroll={checkScrollButtons}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {selectedModels.map(model => {
              const status = getTabStatus(model.id);
              return (
                <button
                  key={model.id}
                  onClick={() => onTabChange(model.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap ${
                    activeTab === model.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{model.name}</span>
                  {getStatusIcon(status)}
                </button>
              );
            })}
            
            {selectedModels.length > 1 && (
              <button
                onClick={() => onTabChange('summary')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Summary Analysis
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default EvaluationTabs;
