// Service for managing tags/attributes for ontology classes
import { aircraftOntology } from './ontologyService';

export interface OntologyTags {
  classId: number;
  className: string;
  tags: string[];
  updatedAt?: Date;
}

const STORAGE_KEY = 'ontology_class_tags';

/**
 * Save tags for an ontology class
 */
export function saveClassTags(classId: number, tags: string[]): void {
  const allTags = getAllClassTags();
  const existingIndex = allTags.findIndex(t => t.classId === classId);
  
  const classTags: OntologyTags = {
    classId,
    className: getAircraftName(classId),
    tags: tags.filter(tag => tag.trim().length > 0), // Remove empty tags
    updatedAt: new Date()
  };
  
  if (existingIndex >= 0) {
    allTags[existingIndex] = classTags;
  } else {
    allTags.push(classTags);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTags));
}

/**
 * Get tags for a specific class
 */
export function getClassTags(classId: number): string[] {
  const allTags = getAllClassTags();
  const classTags = allTags.find(t => t.classId === classId);
  return classTags?.tags || [];
}

/**
 * Get all class tags
 */
export function getAllClassTags(): OntologyTags[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const tags = JSON.parse(stored) as OntologyTags[];
    // Convert date strings back to Date objects
    return tags.map(t => ({
      ...t,
      updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined
    }));
  } catch (error) {
    console.error('Error loading class tags:', error);
    return [];
  }
}

/**
 * Get tags for multiple classes
 */
export function getTagsForClasses(classIds: number[]): Map<number, string[]> {
  const allTags = getAllClassTags();
  const tagsMap = new Map<number, string[]>();
  
  classIds.forEach(classId => {
    const classTags = allTags.find(t => t.classId === classId);
    tagsMap.set(classId, classTags?.tags || []);
  });
  
  return tagsMap;
}

/**
 * Delete tags for a specific class
 */
export function deleteClassTags(classId: number): void {
  const allTags = getAllClassTags();
  const filtered = allTags.filter(t => t.classId !== classId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Get aircraft name by class ID
 */
function getAircraftName(classId: number): string {
  const aircraft = aircraftOntology.find(a => a.id === classId);
  return aircraft?.name || `Class ${classId}`;
}

/**
 * Clear all tags
 */
export function clearAllTags(): void {
  localStorage.removeItem(STORAGE_KEY);
}



