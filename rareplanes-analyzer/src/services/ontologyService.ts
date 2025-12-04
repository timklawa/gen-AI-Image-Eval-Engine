// Aircraft ontology service for Rareplanes dataset - reads from configuration
import { getDefaultOntology } from './evalConfigService';

export interface AircraftClass {
  id: number;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  characteristics: string[];
  role_id: number;
  parentId?: number;
  children?: AircraftClass[];
}

export interface OntologyHierarchy {
  categories: {
    [key: string]: {
      name: string;
      description: string;
      aircraft: AircraftClass[];
    };
  };
  totalAircraft: number;
  totalCategories: number;
}

// Load aircraft ontology from configuration file
function loadAircraftOntology(): AircraftClass[] {
  const configOntology = getDefaultOntology();
  
  return Object.entries(configOntology).map(([id, aircraft]) => {
    const aircraftId = parseInt(id);
    const category = getCategoryForAircraft(aircraft.name);
    const subcategory = getSubcategoryForAircraft(aircraft.name);
    const description = getDescriptionForAircraft(aircraft.name);
    const characteristics = getCharacteristicsForAircraft(aircraft.name);
    
    return {
      id: aircraftId,
      name: aircraft.name,
      category,
      subcategory,
      description,
      characteristics,
      role_id: aircraftId + 1,
      parentId: undefined
    };
  });
}

// Get category based on aircraft name
function getCategoryForAircraft(name: string): string {
  if (name.includes('Civil')) return 'Civil Aircraft';
  if (name.includes('Military')) return 'Military Aircraft';
  return 'Unknown';
}

// Get subcategory based on aircraft name
function getSubcategoryForAircraft(name: string): string {
  if (name.includes('Large Civil Transport')) return 'Large Transport';
  if (name.includes('Medium Civil Transport')) return 'Medium Transport';
  if (name.includes('Small Civil Transport')) return 'Small Transport';
  if (name.includes('Military Bomber')) return 'Bomber';
  if (name.includes('Military Fighter')) return 'Combat Aircraft';
  if (name.includes('Military Trainer')) return 'Training Aircraft';
  if (name.includes('Military Transport')) return 'Transport Aircraft';
  return 'Unknown';
}

// Get description based on aircraft name
function getDescriptionForAircraft(name: string): string {
  const descriptions: { [key: string]: string } = {
    'Large Civil Transport': 'Large civil aircraft used for commercial transport operations',
    'Medium Civil Transport': 'Medium-sized civil aircraft used for regional transport operations',
    'Small Civil Transport': 'Small civil aircraft used for short-range transport and utility operations',
    'Military Bomber': 'Military aircraft designed for bombing missions and strategic attacks',
    'Military Fighter': 'Military aircraft designed for air-to-air and air-to-ground combat',
    'Military Trainer': 'Military aircraft used for pilot training and instruction',
    'Military Transport': 'Military aircraft used for cargo and personnel transport'
  };
  return descriptions[name] || 'Aircraft type';
}

// Get characteristics based on aircraft name
function getCharacteristicsForAircraft(name: string): string[] {
  const characteristics: { [key: string]: string[] } = {
    'Large Civil Transport': ['Large size', 'Civil registration', 'Commercial transport', 'Passenger/cargo capacity'],
    'Medium Civil Transport': ['Medium size', 'Civil registration', 'Regional transport', 'Short to medium range'],
    'Small Civil Transport': ['Small size', 'Civil registration', 'Short range', 'Utility operations'],
    'Military Bomber': ['Military registration', 'Bomb carrying capability', 'Long range', 'Strategic missions'],
    'Military Fighter': ['Military registration', 'Combat role', 'High performance', 'Weapons systems'],
    'Military Trainer': ['Military registration', 'Training role', 'Dual controls', 'Instruction capability'],
    'Military Transport': ['Military registration', 'Cargo capacity', 'Personnel transport', 'Tactical missions']
  };
  return characteristics[name] || ['Aircraft characteristics'];
}

// Load the aircraft ontology from configuration
export const aircraftOntology: AircraftClass[] = loadAircraftOntology();

// Build hierarchy from flat array
export function buildOntologyHierarchy(): OntologyHierarchy {
  const categories: { [key: string]: { name: string; description: string; aircraft: AircraftClass[] } } = {};
  
  // Group aircraft by category
  aircraftOntology.forEach(aircraft => {
    if (!categories[aircraft.category]) {
      categories[aircraft.category] = {
        name: aircraft.category,
        description: getCategoryDescription(aircraft.category),
        aircraft: []
      };
    }
    categories[aircraft.category].aircraft.push(aircraft);
  });

  // Sort aircraft within each category
  Object.keys(categories).forEach(categoryKey => {
    categories[categoryKey].aircraft.sort((a, b) => a.name.localeCompare(b.name));
  });

  return {
    categories,
    totalAircraft: aircraftOntology.length,
    totalCategories: Object.keys(categories).length
  };
}

function getCategoryDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'Civil Aircraft': 'Civilian aircraft used for commercial and utility operations, classified by FAA wingspan standards',
    'Military Aircraft': 'Military aircraft used for various defense operations including combat, transport, and training missions'
  };
  return descriptions[category] || 'Aircraft category';
}

// Get aircraft by ID
export function getAircraftById(id: number): AircraftClass | undefined {
  return aircraftOntology.find(aircraft => aircraft.id === id);
}

// Get aircraft by category
export function getAircraftByCategory(category: string): AircraftClass[] {
  return aircraftOntology.filter(aircraft => aircraft.category === category);
}

// Get all categories
export function getAllCategories(): string[] {
  return Array.from(new Set(aircraftOntology.map(aircraft => aircraft.category))).sort();
}

// Export JSON representation
export function exportOntologyJSON(): string {
  const hierarchy = buildOntologyHierarchy();
  return JSON.stringify(hierarchy, null, 2);
}
