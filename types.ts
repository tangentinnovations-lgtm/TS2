export interface Engine {
  make: string;
  model: string;
  engineCode: string;
  pistonCompressionHeight: number | null;
  pistonVolume: number | null;
  engineBore: number | null;
  engineStroke: number | null;
  combustionChamberVolume: number | null;
  blockDeckHeight: number | null;
  rodLength: number | null;
  rodBigEndBore: number | null;
  crankshaftDiameter: number | null;
  horsepower: number | null;
  compressionRatio: number | null;
  torque: number | null;
  displacement: number | null;
  numCylinders: number | null;
  valvetrain: string | null;
  inductionType: string | null;
  fuelSystem: string | null;
  redlineRPM: number | null;
  engineWeight: number | null;
  blockMaterial: string | null;
  headMaterial: string | null;
  headGasketThickness: number | null;
  connectingRodMaterial: string | null;
  commonWeaknessesStrengths: string | null;
  rodSmallEndBore: number | null;
  crankshaftMaterial: string | null;
  pistonMaterial?: string | null;
}

export interface AftermarketPart {
  name: string;
  description: string;
  link: string;
}

export interface AftermarketPartCategory {
  [category: string]: AftermarketPart[];
}

export interface AftermarketDatabase {
  [engineCode: string]: AftermarketPartCategory;
}

export interface ProvenConfiguration {
  name: string;
  description: string;
  powerOutput: string;
  keyComponents: string[];
  link: string;
}

export interface ProvenConfigurationsDatabase {
  [engineCode: string]: ProvenConfiguration[];
}

export interface UserConfiguration {
  id: string;
  engineCode: string;
  engineMake: string;
  engineModel: string;
  title: string;
  description: string;
  photos: string[];
  dynoLink: string;
  isPublic: boolean;
  likes: number;
  pistons: string;
  rods: string;
  crankshaft: string;
  compressionRatio: string;
  horsepower: string;
  torque: string;
  shopId?: string; // Link to the Verified Network
  shopName?: string;
  // New fields
  inductionType?: string;
  injectorSize?: string;
  fuelPump?: string;
  engineManagement?: string;
  headGasketMod?: string; // "Yes" / "No"
  intakeManifoldType?: string; // "Stock" / "Aftermarket"
}

export interface Review {
  id: string;
  shopId: string;
  author: string;
  rating: number; // out of 5
  title: string;
  text: string;
  date: string;
}

export interface Shop {
  id: string;
  name: string;
  location: string;
  specialties: string[];
  description: string;
  gallery: string[];
  contact: {
    phone: string;
    email: string;
    website: string;
  };
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'error' | 'system';
  text: string;
  groundingSources?: GroundingSource[];
}