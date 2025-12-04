import { ImageData, YOLOAnnotation, DatasetSubset } from '../types';

const DATASET_PATH = '/dataset';

export const datasetSubsets: DatasetSubset[] = [
  {
    name: 'train',
    displayName: 'Training Set',
    imagePath: `${DATASET_PATH}/train/images`,
    labelPath: `${DATASET_PATH}/train/labels`
  }
];

// Aircraft class names for Rareplanes dataset (7 types based on new dataset)
export const classNames: { [key: number]: string } = {
  0: 'Large Civil Transport',
  1: 'Medium Civil Transport',
  2: 'Military Bomber',
  3: 'Military Fighter',
  4: 'Military Trainer',
  5: 'Military Transport',
  6: 'Small Civil Transport'
};

export function parseYOLOAnnotation(line: string): YOLOAnnotation {
  const parts = line.trim().split(' ');
  return {
    classId: parseInt(parts[0]),
    xCenter: parseFloat(parts[1]),
    yCenter: parseFloat(parts[2]),
    width: parseFloat(parts[3]),
    height: parseFloat(parts[4])
  };
}

// Load all image filenames from the dataset
export async function loadImageFilenames(subset: DatasetSubset): Promise<string[]> {
  try {
    // This would typically be an API call to get the list of files
    // For now, we'll return a placeholder that will be populated by the server
    return [];
  } catch (error) {
    console.error('Error loading image filenames:', error);
    return [];
  }
}

// Load image data with pagination support
export async function loadImageData(
  subset: DatasetSubset, 
  page: number = 1, 
  pageSize: number = 50
): Promise<{ images: ImageData[]; total: number; page: number; pageSize: number; totalPages: number }> {
  try {
    // Call the server to get paginated image data
    const response = await fetch(`http://localhost:3001/api/images?subset=${subset.name}&page=${page}&pageSize=${pageSize}`);
    if (!response.ok) {
      throw new Error('Failed to load image data');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading image data:', error);
    return { images: [], total: 0, page, pageSize, totalPages: 0 };
  }
}

// Load a single image by ID
export async function loadImageById(subset: DatasetSubset, imageId: string): Promise<ImageData | null> {
  try {
    const response = await fetch(`http://localhost:3001/api/images/${subset.name}/${imageId}`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

export function convertToPixelCoordinates(
  annotation: YOLOAnnotation,
  imageWidth: number,
  imageHeight: number
) {
  const xCenter = annotation.xCenter * imageWidth;
  const yCenter = annotation.yCenter * imageHeight;
  const width = annotation.width * imageWidth;
  const height = annotation.height * imageHeight;
  
  return {
    x: xCenter - width / 2,
    y: yCenter - height / 2,
    width,
    height
  };
}