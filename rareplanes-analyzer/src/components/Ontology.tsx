import React, { useState, useEffect } from 'react';
import { buildOntologyHierarchy, exportOntologyJSON } from '../services/ontologyService';
import { 
  saveExampleImage, 
  getExampleImage, 
  deleteExampleImage, 
  fileToBase64,
  OntologyExampleImage 
} from '../services/ontologyImageService';
import { 
  saveClassTags, 
  getClassTags, 
  deleteClassTags 
} from '../services/ontologyTagsService';

const Ontology: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showJSON, setShowJSON] = useState(false);
  const [expandedAircraft, setExpandedAircraft] = useState<number | null>(null);
  const [exampleImages, setExampleImages] = useState<Map<number, OntologyExampleImage>>(new Map());
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [tagInputs, setTagInputs] = useState<Map<number, string[]>>(new Map());

  const hierarchy = buildOntologyHierarchy();
  const categories = Object.keys(hierarchy.categories);

  // Load example images and tags on mount
  useEffect(() => {
    const loadExampleImages = () => {
      const images = new Map<number, OntologyExampleImage>();
      for (let i = 0; i < 7; i++) {
        const example = getExampleImage(i);
        if (example) {
          images.set(i, example);
        }
      }
      setExampleImages(images);
    };
    
    const loadTags = () => {
      const tags = new Map<number, string[]>();
      for (let i = 0; i < 7; i++) {
        const classTags = getClassTags(i);
        if (classTags.length > 0) {
          tags.set(i, classTags);
        }
      }
      setTagInputs(tags);
    };
    
    loadExampleImages();
    loadTags();
  }, []);

  const toggleAircraftExpansion = (aircraftId: number) => {
    setExpandedAircraft(expandedAircraft === aircraftId ? null : aircraftId);
  };

  const copyJSONToClipboard = () => {
    navigator.clipboard.writeText(exportOntologyJSON());
    // You could add a toast notification here
  };

  const handleImageUpload = async (aircraftId: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploadingImage(aircraftId);
    try {
      const base64 = await fileToBase64(file);
      saveExampleImage(aircraftId, base64, file.name);
      
      // Update local state
      const example = getExampleImage(aircraftId);
      if (example) {
        setExampleImages(prev => {
          const newMap = new Map(prev);
          newMap.set(aircraftId, example);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleImageDelete = (aircraftId: number) => {
    if (window.confirm('Are you sure you want to delete this example image?')) {
      deleteExampleImage(aircraftId);
      setExampleImages(prev => {
        const newMap = new Map(prev);
        newMap.delete(aircraftId);
        return newMap;
      });
    }
  };

  const handleTagsEdit = (aircraftId: number) => {
    const currentTags = tagInputs.get(aircraftId) || getClassTags(aircraftId);
    setTagInputs(prev => {
      const newMap = new Map(prev);
      newMap.set(aircraftId, [...currentTags]);
      return newMap;
    });
    setEditingTags(aircraftId);
  };

  const handleTagsSave = (aircraftId: number) => {
    const tags = tagInputs.get(aircraftId) || [];
    saveClassTags(aircraftId, tags);
    setEditingTags(null);
  };

  const handleTagsCancel = (aircraftId: number) => {
    const originalTags = getClassTags(aircraftId);
    setTagInputs(prev => {
      const newMap = new Map(prev);
      if (originalTags.length > 0) {
        newMap.set(aircraftId, originalTags);
      } else {
        newMap.delete(aircraftId);
      }
      return newMap;
    });
    setEditingTags(null);
  };

  const handleTagAdd = (aircraftId: number, newTag: string) => {
    if (!newTag.trim()) return;
    setTagInputs(prev => {
      const newMap = new Map(prev);
      const currentTags = newMap.get(aircraftId) || [];
      if (!currentTags.includes(newTag.trim())) {
        newMap.set(aircraftId, [...currentTags, newTag.trim()]);
      }
      return newMap;
    });
  };

  const handleTagRemove = (aircraftId: number, tagToRemove: string) => {
    setTagInputs(prev => {
      const newMap = new Map(prev);
      const currentTags = newMap.get(aircraftId) || [];
      newMap.set(aircraftId, currentTags.filter(tag => tag !== tagToRemove));
      return newMap;
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Aircraft Ontology</h1>
        <p className="text-gray-600">Classification of aircraft types in the current dataset (7 classes)</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>Total Classes: <span className="font-semibold text-primary-600">7</span></span>
          <span>Categories: <span className="font-semibold text-primary-600">2</span></span>
        </div>
      </div>

      {/* Dataset Classes Table */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Dataset Classes & IDs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hierarchy.categories['Civil Aircraft']?.aircraft.map(aircraft => (
                <tr key={aircraft.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{aircraft.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{aircraft.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{aircraft.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{aircraft.description}</td>
                </tr>
              ))}
              {hierarchy.categories['Military Aircraft']?.aircraft.map(aircraft => (
                <tr key={aircraft.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{aircraft.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{aircraft.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{aircraft.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{aircraft.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4">
        <button
          onClick={() => setShowJSON(!showJSON)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {showJSON ? 'Hide JSON' : 'Show JSON'}
        </button>
        
        {showJSON && (
          <button
            onClick={copyJSONToClipboard}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy JSON
          </button>
        )}
      </div>

      {/* JSON Output */}
      {showJSON && (
        <div className="mb-8 bg-gray-900 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">JSON Ontology Export</h3>
            <button
              onClick={copyJSONToClipboard}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          <pre className="text-green-400 text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {exportOntologyJSON()}
          </pre>
        </div>
      )}

      {/* Full-Width Category List */}
      <div className="space-y-4">
        {categories.map((categoryKey) => {
          const category = hierarchy.categories[categoryKey];
          const isSelected = selectedCategory === categoryKey;
          
          return (
            <div
              key={categoryKey}
              className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 ${
                isSelected ? 'ring-2 ring-primary-500 shadow-lg' : 'hover:shadow-lg'
              }`}
            >
              {/* Full-Width Category Header */}
              <div
                className="w-full p-6 cursor-pointer bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200"
                onClick={() => setSelectedCategory(isSelected ? null : categoryKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{category.name}</h3>
                    <p className="text-base text-gray-700 mb-3">{category.description}</p>
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {category.aircraft.length} aircraft type{category.aircraft.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Class IDs: {category.aircraft.map(a => a.id).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center ml-6">
                    <svg
                      className={`w-6 h-6 text-gray-500 transition-transform duration-200 ${
                        isSelected ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expandable Aircraft Grid */}
              {isSelected && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Aircraft in this Category</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {category.aircraft.map((aircraft) => (
                        <div
                          key={aircraft.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-150"
                        >
                          <div
                            className="cursor-pointer"
                            onClick={() => toggleAircraftExpansion(aircraft.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-900 text-sm">{aircraft.name}</h5>
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                  expandedAircraft === aircraft.id ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <p><span className="font-medium">ID:</span> {aircraft.id}</p>
                              {aircraft.subcategory && (
                                <p><span className="font-medium">Type:</span> {aircraft.subcategory}</p>
                              )}
                            </div>
                          </div>
                          
                          {expandedAircraft === aircraft.id && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-sm text-gray-700 mb-3">{aircraft.description}</p>
                              <div className="mb-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">Key Characteristics:</p>
                                <div className="flex flex-wrap gap-1">
                                  {aircraft.characteristics.map((char, index) => (
                                    <span
                                      key={index}
                                      className="inline-block px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full"
                                    >
                                      {char}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Tags/Attributes Section */}
                              <div className="mt-4 pt-3 border-t border-gray-200">
                                <p className="text-xs font-medium text-gray-500 mb-2">Key Attributes/Tags</p>
                                {editingTags === aircraft.id ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                      {(tagInputs.get(aircraft.id) || []).map((tag, index) => (
                                        <span
                                          key={index}
                                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                        >
                                          {tag}
                                          <button
                                            onClick={() => handleTagRemove(aircraft.id, tag)}
                                            className="ml-1 text-blue-600 hover:text-blue-800"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="Add attribute tag..."
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            handleTagAdd(aircraft.id, e.currentTarget.value);
                                            e.currentTarget.value = '';
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() => handleTagsSave(aircraft.id)}
                                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => handleTagsCancel(aircraft.id)}
                                        className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    {tagInputs.get(aircraft.id) && tagInputs.get(aircraft.id)!.length > 0 ? (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {tagInputs.get(aircraft.id)!.map((tag, index) => (
                                          <span
                                            key={index}
                                            className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 mb-2">No tags added</p>
                                    )}
                                    <button
                                      onClick={() => handleTagsEdit(aircraft.id)}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      {tagInputs.get(aircraft.id) && tagInputs.get(aircraft.id)!.length > 0 ? 'Edit Tags' : 'Add Tags'}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Example Image Upload Section */}
                              <div className="mt-4 pt-3 border-t border-gray-200">
                                <p className="text-xs font-medium text-gray-500 mb-2">Example Image for Zero-Shot Classification</p>
                                {exampleImages.has(aircraft.id) ? (
                                  <div className="space-y-2">
                                    <div className="relative">
                                      <img
                                        src={`data:image/jpeg;base64,${exampleImages.get(aircraft.id)?.imageBase64}`}
                                        alt={`Example ${aircraft.name}`}
                                        className="w-full h-32 object-cover rounded border border-gray-300"
                                      />
                                      <button
                                        onClick={() => handleImageDelete(aircraft.id)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        title="Delete example image"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                    <p className="text-xs text-gray-500">{exampleImages.get(aircraft.id)?.imageName}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="block">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            handleImageUpload(aircraft.id, file);
                                          }
                                        }}
                                        className="hidden"
                                        disabled={uploadingImage === aircraft.id}
                                      />
                                      <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:border-primary-500 transition-colors">
                                        {uploadingImage === aircraft.id ? (
                                          <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                                            <span className="ml-2 text-xs text-gray-600">Uploading...</span>
                                          </div>
                                        ) : (
                                          <div>
                                            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            <p className="mt-2 text-xs text-gray-600">Upload example image</p>
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Dataset Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{hierarchy.totalAircraft}</div>
            <div className="text-sm text-gray-600">Aircraft Types</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{hierarchy.totalCategories}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">7</div>
            <div className="text-sm text-gray-600">Class IDs</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ontology;
