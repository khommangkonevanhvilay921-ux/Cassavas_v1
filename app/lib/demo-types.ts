export type DemoRole = "farmer" | "factory" | "admin";
export type ListingStatus = "available" | "paused" | "sold" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "expired" | "withdrawn";
export type TransactionStatus =
  | "OFFER_ACCEPTED"
  | "AWAITING_PICKUP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "INSPECTION_PENDING"
  | "PAYMENT_PENDING"
  | "PAYMENT_CONFIRMED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";

export type DemoFarm = {
  id: string;
  farmerId: string;
  name: string;
  variety: string;
  areaHectares: number;
  estimatedProductionKg: number;
  expectedHarvestDate: string;
  province: string;
  district: string;
  village: string;
  latitude: number;
  longitude: number;
  photos: string[];
  status: "active" | "inactive";
  createdAt: string;
};

export type DemoAssessment = {
  id: string;
  farmerId: string;
  imageNames: string[];
  grade: "A" | "B" | "C";
  damage: string[];
  foreignMaterial: string[];
  confidence: number;
  provider: "simulated";
  createdAt: string;
};

export type DemoListing = {
  id: string;
  farmId: string;
  farmerId: string;
  variety: string;
  totalQuantityKg: number;
  availableQuantityKg: number;
  estimatedGrade: "A" | "B" | "C";
  assessmentId: string | null;
  askingPricePerKg: number | null;
  harvestDate: string;
  expirationDate: string;
  pickupPreference: "pickup" | "delivery" | "either";
  status: ListingStatus;
  createdAt: string;
};

export type DemoOffer = {
  id: string;
  listingId: string;
  farmerId: string;
  factoryId: string;
  pricePerKg: number;
  quantityKg: number;
  transportArrangement: "factory-pickup" | "farmer-delivery" | "shared";
  transportationCost: number;
  farmerTransportCost: number;
  pickupDate: string;
  paymentTerms: string;
  inspectionTerms: string;
  expirationDate: string;
  additionalConditions: string;
  status: OfferStatus;
  counterPricePerKg: number | null;
  counterQuantityKg: number | null;
  createdAt: string;
  updatedAt: string;
  history: { status: string; by: string; note: string; at: string }[];
};

export type DemoTransaction = {
  id: string;
  offerId: string;
  listingId: string;
  farmId: string;
  farmerId: string;
  factoryId: string;
  quantityKg: number;
  finalWeightKg: number | null;
  pricePerKg: number;
  finalGrade: "A" | "B" | "C" | null;
  transportationCost: number;
  farmerTransportCost: number;
  deductions: number;
  grossAmount: number;
  netAmount: number;
  paymentStatus: "pending" | "initiated" | "confirmed";
  deliveryStatus: string;
  status: TransactionStatus;
  receiptConfirmed: boolean;
  disputeReason: string | null;
  createdAt: string;
  history: { status: string; by: string; note: string; at: string }[];
};

export type DemoPrice = {
  id: string;
  province: string;
  district: string;
  grade: "A" | "B" | "C";
  pricePerKg: number;
  source: string;
  effectiveDate: string;
};

export type DemoNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
};

export type DemoMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  listingId: string | null;
  content: string;
  createdAt: string;
};

export type DemoFactoryProfile = {
  id: string;
  name: string;
  province: string;
  district: string;
  verified: boolean;
  capacityTonnes: number;
};

export type DemoState = {
  schemaVersion: number;
  farms: DemoFarm[];
  assessments: DemoAssessment[];
  listings: DemoListing[];
  offers: DemoOffer[];
  transactions: DemoTransaction[];
  prices: DemoPrice[];
  notifications: DemoNotification[];
  messages: DemoMessage[];
  factoryProfiles: DemoFactoryProfile[];
};

export const DEMO_ACCOUNTS: Record<DemoRole, { id: string; name: string; location: string; verified: boolean }> = {
  farmer: { id: "farmer-phonethip", name: "Phonethip S.", location: "Bolikhamxay Province", verified: true },
  factory: { id: "factory-green-valley", name: "Green Valley Starch Co.", location: "Vientiane Province", verified: true },
  admin: { id: "admin-demo", name: "CassavaLink Admin", location: "Vientiane Capital", verified: true },
};

export const DEMO_FACTORIES = [
  { id: DEMO_ACCOUNTS.factory.id, name: "Green Valley Starch Co.", province: "Vientiane Province", district: "Thoulakhom", verified: true, capacityTonnes: 320 },
  { id: "factory-mekong-roots", name: "Mekong Roots Processing", province: "Bolikhamxay", district: "Pakkading", verified: true, capacityTonnes: 180 },
  { id: "factory-nam-ngum", name: "Nam Ngum Agro Works", province: "Xaysomboun", district: "Anouvong", verified: false, capacityTonnes: 90 },
];
