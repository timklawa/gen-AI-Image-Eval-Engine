// Service for managing example images for ontology classes
import { aircraftOntology } from './ontologyService';

export interface OntologyExampleImage {
  classId: number;
  className: string;
  imageBase64: string;
  imageName?: string;
  uploadedAt?: Date;
}

const STORAGE_KEY = 'ontology_example_images';

/**
 * Convert a file to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/jpeg;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Save an example image for an ontology class
 */
export function saveExampleImage(classId: number, imageBase64: string, imageName?: string): void {
  const images = getAllExampleImages();
  const existingIndex = images.findIndex(img => img.classId === classId);
  
  const exampleImage: OntologyExampleImage = {
    classId,
    className: getAircraftName(classId),
    imageBase64,
    imageName: imageName || `example_${classId}.jpg`,
    uploadedAt: new Date()
  };
  
  if (existingIndex >= 0) {
    images[existingIndex] = exampleImage;
  } else {
    images.push(exampleImage);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
}

/**
 * Get example image for a specific class
 */
export function getExampleImage(classId: number): OntologyExampleImage | null {
  const images = getAllExampleImages();
  return images.find(img => img.classId === classId) || null;
}

/**
 * Get all example images
 */
export function getAllExampleImages(): OntologyExampleImage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const images = JSON.parse(stored) as OntologyExampleImage[];
    // Convert date strings back to Date objects
    return images.map(img => ({
      ...img,
      uploadedAt: img.uploadedAt ? new Date(img.uploadedAt) : undefined
    }));
  } catch (error) {
    console.error('Error loading example images:', error);
    return [];
  }
}

/**
 * Delete example image for a specific class
 */
export function deleteExampleImage(classId: number): void {
  const images = getAllExampleImages();
  const filtered = images.filter(img => img.classId !== classId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Get example images for all classes that have them
 */
export function getExampleImagesForClasses(classIds: number[]): OntologyExampleImage[] {
  const allImages = getAllExampleImages();
  return allImages.filter(img => classIds.includes(img.classId));
}

/**
 * Get all example images as a map by class ID
 */
export function getExampleImagesMap(): Map<number, OntologyExampleImage> {
  const images = getAllExampleImages();
  const map = new Map<number, OntologyExampleImage>();
  images.forEach(img => {
    map.set(img.classId, img);
  });
  return map;
}

/**
 * Check if a class has an example image
 */
export function hasExampleImage(classId: number): boolean {
  return getExampleImage(classId) !== null;
}

/**
 * Get aircraft name by class ID
 */
function getAircraftName(classId: number): string {
  const aircraft = aircraftOntology.find(a => a.id === classId);
  return aircraft?.name || `Class ${classId}`;
}

/**
 * Clear all example images
 */
export function clearAllExampleImages(): void {
  localStorage.removeItem(STORAGE_KEY);
}



