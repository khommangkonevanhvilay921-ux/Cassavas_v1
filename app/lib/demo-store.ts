import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEMO_ACCOUNTS, type DemoOffer, type DemoState } from "@/app/lib/demo-types";

const storePath = path.join(process.cwd(), ".local-data", "cassavalink-demo.json");
let pendingWrite: Promise<unknown> = Promise.resolve();

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createdOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function seedState(): DemoState {
  const farms = [
    ["farm-ban-na", "Ban Na family farm", "KM94", 3.8, 15800, "Pakkading", "Ban Na", 18.348, 104.078],
    ["farm-tha-bok", "Tha Bok hillside plots", "Rayong 11", 2.4, 9100, "Pakkading", "Tha Bok", 18.271, 104.147],
    ["farm-nam-thon", "Nam Thon cooperative land", "KM140", 5.2, 22100, "Viengthong", "Nam Thon", 18.551, 104.812],
    ["farm-thoulakhom", "Thoulakhom North Farm", "KM94", 4.1, 17200, "Thoulakhom", "Ban Keun", 18.175, 102.45],
    ["farm-anouvong", "Anouvong valley fields", "Rayong 11", 3.1, 12600, "Anouvong", "Namone", 19.86, 103.098],
  ].map(([id, name, variety, areaHectares, estimatedProductionKg, district, village, latitude, longitude], index) => ({
    id: String(id),
    farmerId: index === 0 || index === 1 ? DEMO_ACCOUNTS.farmer.id : `farmer-demo-${index + 1}`,
    name: String(name), variety: String(variety), areaHectares: Number(areaHectares),
    estimatedProductionKg: Number(estimatedProductionKg), expectedHarvestDate: dateOffset(10 + index * 12),
    province: index < 3 ? "Bolikhamxay" : index === 3 ? "Vientiane Province" : "Xaysomboun",
    district: String(district), village: String(village), latitude: Number(latitude), longitude: Number(longitude),
    photos: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=720&q=75",
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=720&q=75",
    ], status: "active" as const, createdAt: createdOffset(35 - index * 4),
  }));

  const assessments = [
    { id: "assessment-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, imageNames: ["ban-na-sample.jpg"], grade: "A" as const, damage: ["Minor surface scuffing"], foreignMaterial: ["None visible"], confidence: 82, provider: "simulated" as const, createdAt: createdOffset(2) },
    { id: "assessment-tha-bok", farmerId: DEMO_ACCOUNTS.farmer.id, imageNames: ["tha-bok-sample.jpg"], grade: "B" as const, damage: ["Some visible skin damage"], foreignMaterial: ["Soil on root surface"], confidence: 74, provider: "simulated" as const, createdAt: createdOffset(5) },
  ];
  const listings = [
    { id: "listing-ban-na", farmId: "farm-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, variety: "KM94", totalQuantityKg: 12000, availableQuantityKg: 8200, estimatedGrade: "A" as const, assessmentId: "assessment-ban-na", askingPricePerKg: 1550, harvestDate: dateOffset(10), expirationDate: dateOffset(40), pickupPreference: "either" as const, status: "available" as const, createdAt: createdOffset(4) },
    { id: "listing-tha-bok", farmId: "farm-tha-bok", farmerId: DEMO_ACCOUNTS.farmer.id, variety: "Rayong 11", totalQuantityKg: 7500, availableQuantityKg: 7500, estimatedGrade: "B" as const, assessmentId: "assessment-tha-bok", askingPricePerKg: null, harvestDate: dateOffset(22), expirationDate: dateOffset(48), pickupPreference: "pickup" as const, status: "available" as const, createdAt: createdOffset(2) },
    { id: "listing-nam-thon", farmId: "farm-nam-thon", farmerId: "farmer-demo-3", variety: "KM140", totalQuantityKg: 16000, availableQuantityKg: 16000, estimatedGrade: "A" as const, assessmentId: null, askingPricePerKg: 1580, harvestDate: dateOffset(17), expirationDate: dateOffset(45), pickupPreference: "delivery" as const, status: "available" as const, createdAt: createdOffset(1) },
    { id: "listing-thoulakhom", farmId: "farm-thoulakhom", farmerId: "farmer-demo-4", variety: "KM94", totalQuantityKg: 9500, availableQuantityKg: 9500, estimatedGrade: "B" as const, assessmentId: null, askingPricePerKg: null, harvestDate: dateOffset(31), expirationDate: dateOffset(59), pickupPreference: "either" as const, status: "available" as const, createdAt: createdOffset(1) },
    { id: "listing-anouvong", farmId: "farm-anouvong", farmerId: "farmer-demo-5", variety: "Rayong 11", totalQuantityKg: 6800, availableQuantityKg: 6800, estimatedGrade: "C" as const, assessmentId: null, askingPricePerKg: 1450, harvestDate: dateOffset(25), expirationDate: dateOffset(54), pickupPreference: "pickup" as const, status: "available" as const, createdAt: createdOffset(3) },
  ];
  const offers: DemoOffer[] = [
    { id: "offer-ban-na-green", listingId: "listing-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1640, quantityKg: 5000, transportArrangement: "factory-pickup" as const, transportationCost: 420000, farmerTransportCost: 0, pickupDate: dateOffset(12), paymentTerms: "Within 2 business days after inspection", inspectionTerms: "Moisture and visible quality checked at pickup", expirationDate: dateOffset(4), additionalConditions: "Weighbridge receipt shared with both parties", status: "pending" as const, counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(1), updatedAt: createdOffset(1), history: [{ status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Initial purchase offer", at: createdOffset(1) }] },
    { id: "offer-ban-na-mekong", listingId: "listing-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: "factory-mekong-roots", pricePerKg: 1600, quantityKg: 3200, transportArrangement: "shared" as const, transportationCost: 560000, farmerTransportCost: 280000, pickupDate: dateOffset(14), paymentTerms: "Cash confirmation on delivery", inspectionTerms: "Joint visual inspection before weighing", expirationDate: dateOffset(6), additionalConditions: "Transport cost split equally", status: "pending" as const, counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(2), updatedAt: createdOffset(2), history: [{ status: "pending", by: "factory-mekong-roots", note: "Initial purchase offer", at: createdOffset(2) }] },
    { id: "offer-tha-bok-green", listingId: "listing-tha-bok", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1570, quantityKg: 4000, transportArrangement: "farmer-delivery" as const, transportationCost: 600000, farmerTransportCost: 600000, pickupDate: dateOffset(24), paymentTerms: "Within 3 business days after acceptance", inspectionTerms: "Factory scale and sample quality review", expirationDate: dateOffset(8), additionalConditions: "Delivery to Thoulakhom processing site", status: "pending" as const, counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(1), updatedAt: createdOffset(1), history: [{ status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Initial purchase offer", at: createdOffset(1) }] },
    { id: "offer-nam-thon-green", listingId: "listing-nam-thon", farmerId: "farmer-demo-3", factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1620, quantityKg: 6000, transportArrangement: "factory-pickup" as const, transportationCost: 350000, farmerTransportCost: 0, pickupDate: dateOffset(19), paymentTerms: "Within 2 business days after inspection", inspectionTerms: "Moisture and starch lab inspection at factory", expirationDate: dateOffset(3), additionalConditions: "Sample offer for factory account", status: "pending" as const, counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(1), updatedAt: createdOffset(1), history: [{ status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Initial purchase offer", at: createdOffset(1) }] },
  ];
  offers.unshift(
    { id: "offer-completed-ban-na", listingId: "listing-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1550, quantityKg: 3800, transportArrangement: "factory-pickup", transportationCost: 390000, farmerTransportCost: 0, pickupDate: dateOffset(-18), paymentTerms: "Confirmed after weighbridge receipt", inspectionTerms: "Joint sample inspection", expirationDate: dateOffset(-20), additionalConditions: "Sample completed sale", status: "accepted", counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(24), updatedAt: createdOffset(20), history: [{ status: "accepted", by: DEMO_ACCOUNTS.farmer.id, note: "Sample offer accepted; quantity reserved.", at: createdOffset(20) }, { status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Sample historical offer", at: createdOffset(24) }] },
    { id: "offer-transit-tha-bok", listingId: "listing-tha-bok", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1570, quantityKg: 2500, transportArrangement: "factory-pickup", transportationCost: 160000, farmerTransportCost: 0, pickupDate: dateOffset(-1), paymentTerms: "Payment after final inspection", inspectionTerms: "Final scale weight at factory", expirationDate: dateOffset(-5), additionalConditions: "Sample active procurement", status: "accepted", counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(7), updatedAt: createdOffset(5), history: [{ status: "accepted", by: DEMO_ACCOUNTS.farmer.id, note: "Sample offer accepted; quantity reserved.", at: createdOffset(5) }, { status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Sample historical offer", at: createdOffset(7) }] },
  );
  const transactions = [
    { id: "CL-2026-0018", offerId: "offer-completed-ban-na", listingId: "listing-ban-na", farmId: "farm-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, quantityKg: 3800, finalWeightKg: 3700, pricePerKg: 1550, finalGrade: "A" as const, transportationCost: 390000, farmerTransportCost: 0, deductions: 100000, grossAmount: 5735000, netAmount: 5635000, paymentStatus: "confirmed" as const, deliveryStatus: "Completed", status: "COMPLETED" as const, receiptConfirmed: true, disputeReason: null, createdAt: createdOffset(20), history: [{ status: "COMPLETED", by: DEMO_ACCOUNTS.farmer.id, note: "Demo receipt confirmed after external payment confirmation.", at: createdOffset(18) }, { status: "PAYMENT_CONFIRMED", by: DEMO_ACCOUNTS.factory.id, note: "Sample payment status confirmation; no money transferred by demo.", at: createdOffset(19) }] },
    { id: "CL-2026-0021", offerId: "offer-transit-tha-bok", listingId: "listing-tha-bok", farmId: "farm-tha-bok", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, quantityKg: 2500, finalWeightKg: null, pricePerKg: 1570, finalGrade: null, transportationCost: 160000, farmerTransportCost: 0, deductions: 0, grossAmount: 3925000, netAmount: 3925000, paymentStatus: "pending" as const, deliveryStatus: "In transit", status: "IN_TRANSIT" as const, receiptConfirmed: false, disputeReason: null, createdAt: createdOffset(5), history: [{ status: "IN_TRANSIT", by: DEMO_ACCOUNTS.factory.id, note: "Sample procurement shipment is in transit.", at: createdOffset(1) }, { status: "AWAITING_PICKUP", by: DEMO_ACCOUNTS.factory.id, note: "Sample pickup scheduled.", at: createdOffset(4) }, { status: "OFFER_ACCEPTED", by: DEMO_ACCOUNTS.farmer.id, note: "Sample offer accepted; quantity reserved.", at: createdOffset(5) }] },
  ];
  listings.find((listing) => listing.id === "listing-tha-bok")!.availableQuantityKg = 5000;
  const prices = [];
  for (const region of [
    ["Bolikhamxay", "Pakkading", 1600], ["Bolikhamxay", "Viengthong", 1570],
    ["Vientiane Province", "Thoulakhom", 1540], ["Xaysomboun", "Anouvong", 1500],
  ] as const) {
    for (const grade of ["A", "B", "C"] as const) {
      const gradeAdjustment = grade === "A" ? 80 : grade === "C" ? -100 : 0;
      for (let week = 12; week >= 0; week--) {
        prices.push({
          id: `price-${region[1]}-${grade}-${week}`,
          province: region[0], district: region[1], grade,
          pricePerKg: region[2] + gradeAdjustment + ((week * 17 + region[2]) % 71) - 35,
          source: "CassavaLink sample provincial bulletin",
          effectiveDate: dateOffset(-week * 7),
        });
      }
    }
  }
  return {
    schemaVersion: 2,
    farms, assessments, listings, offers, transactions, prices,
    notifications: [
      { id: "notification-offer-1", userId: DEMO_ACCOUNTS.farmer.id, title: "New buyer offer", message: "Green Valley Starch offered 1,640 LAK/kg for Ban Na harvest.", type: "offer", readAt: null, createdAt: createdOffset(1) },
      { id: "notification-offer-2", userId: DEMO_ACCOUNTS.farmer.id, title: "Another offer to compare", message: "Mekong Roots Processing made an offer on Ban Na harvest.", type: "offer", readAt: null, createdAt: createdOffset(2) },
    ], messages: [], factoryProfiles: [
      { id: DEMO_ACCOUNTS.factory.id, name: "Green Valley Starch Co.", province: "Vientiane Province", district: "Thoulakhom", verified: true, capacityTonnes: 320 },
      { id: "factory-mekong-roots", name: "Mekong Roots Processing", province: "Bolikhamxay", district: "Pakkading", verified: true, capacityTonnes: 180 },
      { id: "factory-nam-ngum", name: "Nam Ngum Agro Works", province: "Xaysomboun", district: "Anouvong", verified: false, capacityTonnes: 90 },
    ],
  };
}

async function readStore(): Promise<DemoState> {
  try {
    const stored = JSON.parse(await readFile(storePath, "utf8")) as Partial<DemoState>;
    if (stored.schemaVersion === 2) return stored as DemoState;

    const seeded = seedState();
    const migrated = { ...seeded, ...stored } as DemoState;
    migrated.factoryProfiles = stored.factoryProfiles ?? seeded.factoryProfiles;
    migrated.farms = stored.farms ?? seeded.farms;
    migrated.assessments = stored.assessments ?? seeded.assessments;
    migrated.listings = stored.listings ?? seeded.listings;
    migrated.offers = stored.offers ?? seeded.offers;
    migrated.prices = stored.prices ?? seeded.prices;
    migrated.notifications = stored.notifications ?? seeded.notifications;
    migrated.messages = stored.messages ?? [];
    migrated.transactions = stored.transactions?.length ? stored.transactions : seeded.transactions;
    for (const seededOffer of seeded.offers.filter((offer) => offer.id.startsWith("offer-completed-") || offer.id.startsWith("offer-transit-"))) {
      if (!migrated.offers.some((offer) => offer.id === seededOffer.id)) migrated.offers.push(seededOffer);
    }
    const transitListing = migrated.listings.find((listing) => listing.id === "listing-tha-bok");
    if (transitListing?.availableQuantityKg === 7500 && !stored.transactions?.length) transitListing.availableQuantityKg = 5000;
    migrated.schemaVersion = 2;
    await persist(migrated);
    return migrated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const state = seedState();
    await persist(state);
    return state;
  }
}

async function persist(state: DemoState) {
  await mkdir(path.dirname(storePath), { recursive: true });
  const temporary = `${storePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
  await rename(temporary, storePath);
}

export async function getDemoState() {
  return readStore();
}

export async function updateDemoState<T>(mutate: (state: DemoState) => T | Promise<T>): Promise<T> {
  let result!: T;
  const operation = pendingWrite.then(async () => {
    const state = await readStore();
    result = await mutate(state);
    await persist(state);
  });
  pendingWrite = operation.catch(() => undefined);
  await operation;
  return result;
}
