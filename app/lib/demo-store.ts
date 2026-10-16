import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEMO_ACCOUNTS, type DemoAccount, type DemoOffer, type DemoPrice, type DemoState } from "@/app/lib/demo-types";
import { getOfficialPrice } from "@/app/lib/pricing";

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
    { id: "offer-completed-ban-na", listingId: "listing-ban-na", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1550, quantityKg: 3800, transportArrangement: "factory-pickup", transportationCost: 390000, farmerTransportCost: 0, pickupDate: dateOffset(-18), paymentTerms: "Confirm directly after weighing", inspectionTerms: "Joint sample inspection", expirationDate: dateOffset(-20), additionalConditions: "Sample accepted offer for direct follow-up", status: "accepted", counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(24), updatedAt: createdOffset(20), history: [{ status: "accepted", by: DEMO_ACCOUNTS.farmer.id, note: "Sample offer accepted; coordinate directly with the buyer.", at: createdOffset(20) }, { status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Sample historical offer", at: createdOffset(24) }] },
    { id: "offer-transit-tha-bok", listingId: "listing-tha-bok", farmerId: DEMO_ACCOUNTS.farmer.id, factoryId: DEMO_ACCOUNTS.factory.id, pricePerKg: 1570, quantityKg: 2500, transportArrangement: "factory-pickup", transportationCost: 160000, farmerTransportCost: 0, pickupDate: dateOffset(-1), paymentTerms: "Discuss payment directly", inspectionTerms: "Final scale weight at factory", expirationDate: dateOffset(-5), additionalConditions: "Sample accepted offer for direct follow-up", status: "accepted", counterPricePerKg: null, counterQuantityKg: null, createdAt: createdOffset(7), updatedAt: createdOffset(5), history: [{ status: "accepted", by: DEMO_ACCOUNTS.farmer.id, note: "Sample offer accepted; coordinate directly with the buyer.", at: createdOffset(5) }, { status: "pending", by: DEMO_ACCOUNTS.factory.id, note: "Sample historical offer", at: createdOffset(7) }] },
  );
  listings.find((listing) => listing.id === "listing-ban-na")!.availableQuantityKg = 12000;
  listings.find((listing) => listing.id === "listing-tha-bok")!.availableQuantityKg = 7500;
  const prices: DemoPrice[] = [];
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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  for (const factory of [
    { id: DEMO_ACCOUNTS.factory.id, name: "Green Valley Starch Co.", province: "Vientiane Province", district: "Thoulakhom", base: 1540 },
    { id: "factory-mekong-roots", name: "Mekong Roots Processing", province: "Bolikhamxay", district: "Pakkading", base: 1600 },
    { id: "factory-nam-ngum", name: "Nam Ngum Agro Works", province: "Xaysomboun", district: "Anouvong", base: 1500 },
  ]) {
    for (const grade of ["A", "B", "C"] as const) {
      prices.unshift({
        id: `official-${factory.id}-${grade}`,
        province: factory.province,
        district: factory.district,
        grade,
        pricePerKg: factory.base + (grade === "A" ? 80 : grade === "C" ? -100 : 0),
        source: `Official factory daily price · ${factory.name} (prototype sample)`,
        effectiveDate: today,
        priceType: "official",
        factoryId: factory.id,
      });
    }
  }
  return {
    schemaVersion: 4,
    farms, assessments, listings, offers, accounts: [], prices,
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
    const stored = JSON.parse(await readFile(storePath, "utf8")) as Partial<DemoState> & { transactions?: unknown };
    if (stored.schemaVersion === 4) {
      Reflect.deleteProperty(stored, "transactions");
      stored.accounts ??= [];
      return stored as DemoState;
    }

    const seeded = seedState();
    const migrated = { ...seeded, ...stored } as DemoState;
    Reflect.deleteProperty(migrated, "transactions");
    migrated.factoryProfiles = stored.factoryProfiles ?? seeded.factoryProfiles;
    migrated.farms = stored.farms ?? seeded.farms;
    migrated.assessments = stored.assessments ?? seeded.assessments;
    migrated.listings = stored.listings ?? seeded.listings;
    migrated.offers = stored.offers ?? seeded.offers;
    migrated.prices = stored.prices ?? seeded.prices;
    migrated.notifications = (stored.notifications ?? seeded.notifications).filter((notification) => !["transaction", "payment", "dispute"].includes(notification.type));
    migrated.messages = stored.messages ?? [];
    migrated.accounts = (stored.accounts ?? []).map((account) => {
      const oldStatus = account.status as string;
      const status: DemoAccount["status"] = oldStatus === "approved"
        ? "Approved"
        : oldStatus === "rejected"
          ? "Rejected"
          : oldStatus === "pending"
            ? "Pending Admin Approval"
            : oldStatus === "Pending Verification" || oldStatus === "Pending Admin Approval" || oldStatus === "Approved" || oldStatus === "Rejected"
              ? oldStatus
              : "Pending Admin Approval";
      return {
        ...account,
        email: account.email ?? null,
        phone: account.phone ?? null,
        contactMethod: account.contactMethod ?? "email",
        status,
        submittedAt: account.submittedAt ?? account.createdAt,
        verificationCode: account.verificationCode ?? "",
        rejectionReason: account.rejectionReason ?? null,
        kycDocumentType: account.kycDocumentType ?? "Family Book",
        kycDocuments: account.kycDocuments ?? [],
      };
    });
    if (!migrated.prices.some((price) => price.priceType === "official")) {
      migrated.prices.push(...seeded.prices.filter((price) => price.priceType === "official"));
    }
    for (const offer of migrated.offers) {
      if (!offer.middlemanId || (offer.status !== "pending" && offer.status !== "countered")) continue;
      const listing = migrated.listings.find((item) => item.id === offer.listingId);
      const farm = listing && migrated.farms.find((item) => item.id === listing.farmId);
      const officialPrice = listing && farm
        ? getOfficialPrice(migrated.prices, farm.province, farm.district, listing.estimatedGrade)
        : null;
      if (officialPrice) offer.pricePerKg = officialPrice.pricePerKg;
      offer.counterPricePerKg = null;
      offer.counterQuantityKg = null;
      if (offer.status === "countered") offer.status = "pending";
    }
    for (const seededOffer of seeded.offers.filter((offer) => offer.id.startsWith("offer-completed-") || offer.id.startsWith("offer-transit-"))) {
      if (!migrated.offers.some((offer) => offer.id === seededOffer.id)) migrated.offers.push(seededOffer);
    }
    for (const offer of migrated.offers) {
      for (const event of offer.history) {
        if (event.note.includes("quantity reserved")) event.note = "Offer accepted; coordinate directly with the other party.";
      }
    }
    migrated.schemaVersion = 4;
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
