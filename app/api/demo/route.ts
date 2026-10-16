import { NextResponse } from "next/server";
import { getDemoIdentity } from "@/app/lib/demo-session";
import { getDemoState, updateDemoState } from "@/app/lib/demo-store";
import { calculatePrice, getOfficialPrice } from "@/app/lib/pricing";
import { DEMO_ACCOUNTS, type DemoAccount, type DemoAssessment, type DemoFarm, type DemoListing, type DemoMessage, type DemoNotification, type DemoOffer, type DemoPrice, type DemoRole, type DemoState, type ListingStatus } from "@/app/lib/demo-types";

export const runtime = "nodejs";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function text(value: unknown, maxLength = 300) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numeric(value: unknown, min = 0, max = 1_000_000_000) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Math.round(number) : null;
}

function imageList(value: unknown) {
  if (!Array.isArray(value) || value.length > 8) return null;
  if (value.some((item) => typeof item !== "string" || item.length > 1_500_000)) return null;
  return value as string[];
}

function roleError(identity: Awaited<ReturnType<typeof getDemoIdentity>>, role: DemoRole) {
  return identity?.role === role || identity?.role === "admin" ? null : error(`Sign in with a ${role} demo account to do that.`, 403);
}

function safeState(state: DemoState) {
  return {
    farms: state.farms.map(publicFarm),
    assessments: state.assessments,
    listings: state.listings,
    offers: state.offers,
    prices: state.prices,
    notifications: state.notifications,
    messages: state.messages,
    factories: state.factoryProfiles,
  };
}

function publicFarm(farm: DemoFarm) {
  return { id: farm.id, farmerId: farm.farmerId, name: farm.name, variety: farm.variety, areaHectares: farm.areaHectares, estimatedProductionKg: farm.estimatedProductionKg, expectedHarvestDate: farm.expectedHarvestDate, province: farm.province, district: farm.district, village: farm.village, photos: farm.photos, status: farm.status, createdAt: farm.createdAt };
}

function publicAccount(account: DemoAccount) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    contactMethod: account.contactMethod,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    submittedAt: account.submittedAt,
    rejectionReason: account.rejectionReason,
    kycDocumentType: account.kycDocumentType,
    kycDocuments: account.kycDocuments,
  };
}

function pushNotification(state: DemoState, userId: string, title: string, message: string, type: string) {
  const notification: DemoNotification = { id: crypto.randomUUID(), userId, title, message, type, readAt: null, createdAt: new Date().toISOString() };
  state.notifications.unshift(notification);
}

function listingWithFarm(state: DemoState, listingId: string) {
  const listing = state.listings.find((item) => item.id === listingId);
  if (!listing) return null;
  const farm = state.farms.find((item) => item.id === listing.farmId);
  return farm ? { listing, farm } : null;
}

function offerHistory(offer: DemoOffer, status: string, by: string, note: string) {
  offer.history.unshift({ status, by, note, at: new Date().toISOString() });
  offer.updatedAt = new Date().toISOString();
}

export async function GET(request: Request) {
  const state = await getDemoState();
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  const identity = await getDemoIdentity();
  const data = safeState(state);

  if (view === "session") return NextResponse.json({ identity });
  if (view === "marketplace") {
    const listings = state.listings.filter((listing) => listing.status === "available" && listing.availableQuantityKg > 0);
    const farmIds = new Set(listings.map((listing) => listing.farmId));
    const assessmentIds = new Set(listings.map((listing) => listing.assessmentId).filter((id): id is string => Boolean(id)));
    return NextResponse.json({ farms: state.farms.filter((farm) => farm.status === "active" && farmIds.has(farm.id)).map(publicFarm), listings, assessments: state.assessments.filter((assessment) => assessmentIds.has(assessment.id)).map((assessment) => ({ id: assessment.id, grade: assessment.grade, damage: assessment.damage, foreignMaterial: assessment.foreignMaterial, confidence: assessment.confidence, provider: assessment.provider, createdAt: assessment.createdAt })), factories: state.factoryProfiles, prices: state.prices });
  }
  if (view === "prices") return NextResponse.json({ prices: data.prices, factories: data.factories, listings: state.listings.map((listing) => { const farm = state.farms.find((item) => item.id === listing.farmId); return { id: listing.id, province: farm?.province ?? "Laos", district: farm?.district ?? "", variety: listing.variety, availableQuantityKg: listing.availableQuantityKg, estimatedGrade: listing.estimatedGrade }; }) });
  if (view === "farmer") {
    if (identity?.role !== "farmer" && identity?.role !== "admin") return error("Sign in to view farmer records.", 403);
    return NextResponse.json({ ...data, farms: state.farms.filter((farm) => farm.farmerId === identity.id).map(publicFarm), listings: state.listings.filter((listing) => listing.farmerId === identity.id), offers: state.offers.filter((offer) => offer.farmerId === identity.id), assessments: state.assessments.filter((assessment) => assessment.farmerId === identity.id), notifications: state.notifications.filter((notification) => notification.userId === identity.id), messages: state.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id) });
  }
  if (view === "factory") {
    if (identity?.role !== "factory" && identity?.role !== "admin") return error("Sign in to view factory records.", 403);
    return NextResponse.json({ ...data, farms: state.farms.map(publicFarm), assessments: state.assessments.map((assessment) => ({ id: assessment.id, farmerId: assessment.farmerId, grade: assessment.grade, damage: assessment.damage, foreignMaterial: assessment.foreignMaterial, confidence: assessment.confidence, provider: assessment.provider, createdAt: assessment.createdAt })), offers: state.offers.filter((offer) => offer.factoryId === identity.id), notifications: state.notifications.filter((notification) => notification.userId === identity.id), messages: state.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id) });
  }
  if (view === "middleman") {
    if (identity?.role !== "middleman" && identity?.role !== "admin") return error("Middleman access is required.", 403);
    const listings = state.listings.filter((listing) => listing.status === "available" && listing.availableQuantityKg > 0);
    const farmIds = new Set(listings.map((listing) => listing.farmId));
    return NextResponse.json({
      farms: state.farms.filter((farm) => farm.status === "active" && farmIds.has(farm.id)).map(publicFarm),
      listings,
      offers: state.offers.filter((offer) => offer.middlemanId === identity.id),
      prices: state.prices,
      notifications: state.notifications.filter((notification) => notification.userId === identity.id),
      messages: state.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id),
      factories: state.factoryProfiles,
    });
  }
  if (view === "admin") {
    if (identity?.role !== "admin") return error("Administrator access is required.", 403);
    return NextResponse.json({ ...data, accounts: state.accounts.map(publicAccount) });
  }
  return error("Choose a data view.");
}

export async function POST(request: Request) {
  const identity = await getDemoIdentity();
  if (!identity) return error("Sign in with a demo account before continuing.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("action" in body) || typeof (body as { action: unknown }).action !== "string") return error("A valid action is required.");
  const { action, ...payload } = body as Record<string, unknown>;
  const now = new Date().toISOString();

  try {
    const result = await updateDemoState((state) => {
      if (action === "create-farm") {
        if (roleError(identity, "farmer")) throw new Error("403:Sign in as a farmer to create a farm.");
        const name = text(payload.name, 80); const variety = text(payload.variety, 40);
        const areaHectares = Number(payload.areaHectares); const estimatedProductionKg = numeric(payload.estimatedProductionKg, 1, 1_000_000);
        const province = text(payload.province, 80); const district = text(payload.district, 80); const village = text(payload.village, 100);
        if (!name || !variety || !Number.isFinite(areaHectares) || areaHectares <= 0 || !estimatedProductionKg || !province || !district) throw new Error("Farm name, variety, valid area, production, province, and district are required.");
        const photoUrl = text(payload.photosText, 1200);
        const farm: DemoFarm = { id: `farm-${crypto.randomUUID()}`, farmerId: identity.id, name, variety, areaHectares, estimatedProductionKg, expectedHarvestDate: text(payload.expectedHarvestDate, 20) || new Date().toISOString().slice(0, 10), province, district, village, latitude: Number(payload.latitude) || 18.2, longitude: Number(payload.longitude) || 103.4, photos: imageList(payload.photos) ?? (photoUrl.startsWith("https://") ? [photoUrl] : []), status: "active", createdAt: now };
        state.farms.unshift(farm);
        return farm;
      }
      if (action === "update-farm") {
        if (roleError(identity, "farmer")) throw new Error("403:Sign in as a farmer to update a farm.");
        const farm = state.farms.find((item) => item.id === payload.id && item.farmerId === identity.id);
        if (!farm) throw new Error("Farm not found for this farmer.");
        for (const field of ["name", "variety", "province", "district", "village"] as const) if (payload[field] !== undefined) farm[field] = text(payload[field], 100);
        if (payload.areaHectares !== undefined) { const value = Number(payload.areaHectares); if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid farm area."); farm.areaHectares = value; }
        if (payload.estimatedProductionKg !== undefined) { const value = numeric(payload.estimatedProductionKg, 1, 1_000_000); if (!value) throw new Error("Enter a valid production quantity."); farm.estimatedProductionKg = value; }
        if (payload.status === "active" || payload.status === "inactive") farm.status = payload.status;
        if (payload.photos !== undefined) { const photos = imageList(payload.photos); if (!photos) throw new Error("Use up to 8 images, each smaller than 1.5 MB."); farm.photos = photos; }
        if (payload.photosText !== undefined) { const photoUrl = text(payload.photosText, 1200); if (photoUrl && !photoUrl.startsWith("https://")) throw new Error("Farm photo URL must use HTTPS."); if (photoUrl) farm.photos = [...new Set([photoUrl, ...farm.photos])].slice(0, 8); }
        return farm;
      }
      if (action === "create-listing") {
        if (roleError(identity, "farmer")) throw new Error("403:Sign in as a farmer to publish a harvest.");
        const farm = state.farms.find((item) => item.id === payload.farmId && item.farmerId === identity.id && item.status === "active");
        const quantityKg = numeric(payload.quantityKg, 1, 1_000_000);
        if (!farm || !quantityKg) throw new Error("Choose an active farm and enter a valid quantity.");
        const alreadyListed = state.listings.filter((listing) => listing.farmId === farm.id && listing.status !== "cancelled").reduce((total, listing) => total + listing.totalQuantityKg, 0);
        if (quantityKg + alreadyListed > farm.estimatedProductionKg && payload.confirmAboveEstimate !== true && payload.confirmAboveEstimate !== "true") throw new Error("This quantity exceeds the farm estimate. Confirm that the harvest estimate is higher to continue.");
        const listing: DemoListing = { id: `listing-${crypto.randomUUID()}`, farmId: farm.id, farmerId: identity.id, variety: farm.variety, totalQuantityKg: quantityKg, availableQuantityKg: quantityKg, estimatedGrade: payload.grade === "A" || payload.grade === "C" ? payload.grade : "B", assessmentId: null, askingPricePerKg: payload.askingPricePerKg ? numeric(payload.askingPricePerKg, 1, 100_000) : null, harvestDate: text(payload.harvestDate, 20) || farm.expectedHarvestDate, expirationDate: text(payload.expirationDate, 20) || dateAfter(30), pickupPreference: payload.pickupPreference === "delivery" || payload.pickupPreference === "either" ? payload.pickupPreference : "pickup", status: payload.publish === true || payload.publish === "true" ? "available" : "paused", createdAt: now };
        state.listings.unshift(listing);
        return listing;
      }
      if (action === "update-listing") {
        if (roleError(identity, "farmer")) throw new Error("403:Sign in as a farmer to update a listing.");
        const listing = state.listings.find((item) => item.id === payload.id && item.farmerId === identity.id);
        if (!listing) throw new Error("Harvest listing not found.");
        if (payload.status && ["available", "paused", "cancelled"].includes(String(payload.status))) listing.status = payload.status as ListingStatus;
        if (payload.quantityKg !== undefined) {
          const quantity = numeric(payload.quantityKg, 1, 1_000_000);
          const reserved = listing.totalQuantityKg - listing.availableQuantityKg;
          if (!quantity || quantity < reserved) throw new Error("Quantity cannot be lower than the already reserved amount.");
          listing.totalQuantityKg = quantity; listing.availableQuantityKg = quantity - reserved;
        }
        if (payload.askingPricePerKg !== undefined) listing.askingPricePerKg = payload.askingPricePerKg === null || payload.askingPricePerKg === "" ? null : numeric(payload.askingPricePerKg, 1, 100_000);
        return listing;
      }
      if (action === "create-assessment") {
        if (roleError(identity, "farmer")) throw new Error("403:Sign in as a farmer to assess cassava photos.");
        const imageNames = imageList(payload.imageNames);
        if (!imageNames?.length || imageNames.some((name) => typeof name !== "string")) throw new Error("Upload at least one supported image.");
        const grade = (imageNames.length % 3 === 0 ? "C" : imageNames.length % 2 === 0 ? "B" : "A") as DemoAssessment["grade"];
        const assessment: DemoAssessment = { id: `assessment-${crypto.randomUUID()}`, farmerId: identity.id, imageNames: imageNames.map((name) => text(name, 100)), grade, damage: grade === "A" ? ["Minor surface scuffing visible"] : grade === "B" ? ["Moderate visible skin marks"] : ["Several dark or damaged areas visible"], foreignMaterial: ["Visual check only; soil may be present"], confidence: grade === "A" ? 82 : grade === "B" ? 74 : 66, provider: "simulated", createdAt: now };
        state.assessments.unshift(assessment);
        return assessment;
      }
      if (action === "attach-assessment") {
        if (roleError(identity, "farmer")) throw new Error("403:Farmer access required.");
        const listing = state.listings.find((item) => item.id === payload.listingId && item.farmerId === identity.id);
        const assessment = state.assessments.find((item) => item.id === payload.assessmentId && item.farmerId === identity.id);
        if (!listing || !assessment) throw new Error("Choose one of your listings and assessments.");
        listing.assessmentId = assessment.id; listing.estimatedGrade = assessment.grade;
        return listing;
      }
      if (action === "create-offer") {
        if (identity.role !== "factory" && identity.role !== "middleman") throw new Error("403:Factory or middleman access is required to submit an offer.");
        if (identity.role === "middleman" && payload.pricePerKg !== undefined) {
          throw new Error("Middleman purchase requests do not accept a submitted price; the official factory price is applied automatically.");
        }
        const listingId = text(payload.listingId, 100); const match = listingWithFarm(state, listingId);
        const factory = state.factoryProfiles.find((item) => item.id === identity.id);
        const officialPrice = identity.role === "middleman" && match
          ? getOfficialPrice(state.prices, match.farm.province, match.farm.district, match.listing.estimatedGrade)
          : null;
        const pricePerKg = identity.role === "middleman" ? officialPrice?.pricePerKg ?? null : numeric(payload.pricePerKg, 1, 100_000);
        if (identity.role === "factory" && !factory?.verified) throw new Error("This factory is not verified and cannot submit offers.");
        if (!match || match.listing.status !== "available" || match.listing.availableQuantityKg < 1) throw new Error("This harvest is no longer available.");
        const quantityKg = numeric(payload.quantityKg, 1, 1_000_000);
        if (identity.role === "middleman" && !officialPrice) throw new Error("No official factory price is published for this listing's location and grade.");
        if (!pricePerKg || !quantityKg || quantityKg > match.listing.availableQuantityKg) throw new Error("Enter a valid quantity within the harvest's available amount.");
        const arrangement = payload.transportArrangement === "farmer-delivery" || payload.transportArrangement === "shared" ? payload.transportArrangement : "factory-pickup";
        const transportationCost = numeric(payload.transportationCost ?? 0, 0, 100_000_000);
        if (transportationCost === null) throw new Error("Enter a valid transportation cost.");
        const calculation = calculatePrice({ pricePerKg, quantityKg, transportArrangement: arrangement, transportationCost });
        const offer: DemoOffer = { id: `offer-${crypto.randomUUID()}`, listingId, farmerId: match.listing.farmerId, ...(identity.role === "factory" ? { factoryId: identity.id } : { middlemanId: identity.id }), pricePerKg, quantityKg, transportArrangement: arrangement, transportationCost, farmerTransportCost: calculation.farmerTransportCost, pickupDate: text(payload.pickupDate, 20) || dateAfter(14), paymentTerms: text(payload.paymentTerms, 240) || "Any sale and payment are arranged directly outside CassavaLink.", inspectionTerms: text(payload.inspectionTerms, 240) || "Inspection to be arranged directly by both parties.", expirationDate: text(payload.expirationDate, 20) || dateAfter(7), additionalConditions: text(payload.additionalConditions, 400), status: "pending", counterPricePerKg: null, counterQuantityKg: null, createdAt: now, updatedAt: now, history: [{ status: "pending", by: identity.id, note: "Offer submitted for direct follow-up outside CassavaLink", at: now }] };
        state.offers.unshift(offer);
        const buyerName = identity.role === "factory" ? factory?.name ?? "Factory" : (identity.id === DEMO_ACCOUNTS.middleman.id ? DEMO_ACCOUNTS.middleman.name : state.accounts.find((account) => account.id === identity.id)?.name ?? "Middleman");
        pushNotification(state, offer.farmerId, identity.role === "middleman" ? "Purchase request at official price" : "New buyer offer", `${buyerName} ${identity.role === "middleman" ? "requested" : "offered"} ${pricePerKg.toLocaleString()} LAK/kg for ${quantityKg.toLocaleString()} kg.`, "offer");
        return offer;
      }
      if (action === "update-offer") {
        if (identity.role !== "factory") throw new Error("403:Factory access is required to edit an offer.");
        const offer = state.offers.find((item) => item.id === payload.offerId && item.factoryId === identity.id);
        if (!offer || offer.status !== "pending") throw new Error("Only your pending offers can be edited.");
        const listing = state.listings.find((item) => item.id === offer.listingId);
        const price = payload.pricePerKg === undefined ? offer.pricePerKg : numeric(payload.pricePerKg, 1, 100_000);
        const quantity = payload.quantityKg === undefined ? offer.quantityKg : numeric(payload.quantityKg, 1, 1_000_000);
        if (!listing || !price || !quantity || quantity > listing.availableQuantityKg) throw new Error("Enter a valid price and a quantity within remaining listing availability.");
        offer.pricePerKg = price; offer.quantityKg = quantity;
        offerHistory(offer, "pending", identity.id, `Factory edited offer terms: ${price} LAK/kg for ${quantity} kg.`);
        const factoryName = state.factoryProfiles.find((item) => item.id === identity.id)?.name ?? "Verified factory";
        pushNotification(state, offer.farmerId, "Buyer offer updated", `${factoryName} updated an offer to ${price.toLocaleString()} LAK/kg for ${quantity.toLocaleString()} kg.`, "offer");
        return offer;
      }
      if (action === "respond-offer") {
        const offer = state.offers.find((item) => item.id === payload.offerId);
        if (!offer) throw new Error("Offer not found.");
        const buyerId = offer.middlemanId ?? offer.factoryId;
        if (!buyerId) throw new Error("This offer has no buyer account.");
        if (offer.status !== "pending" && offer.status !== "countered") throw new Error("This offer can no longer be changed.");
        const todayInLaos = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        if (offer.expirationDate < todayInLaos) { offer.status = "expired"; throw new Error("This offer has expired."); }
        const decision = payload.decision;
        if (decision === "counter" && offer.middlemanId) {
          throw new Error("Negotiated prices are disabled for middleman purchases; the official factory price must be used.");
        }
        if (decision === "accept") {
          if (identity.role !== "farmer" || identity.id !== offer.farmerId) throw new Error("403:Only the listed farmer can accept this offer.");
          const match = listingWithFarm(state, offer.listingId);
          const agreedQuantity = offer.middlemanId ? offer.quantityKg : offer.counterQuantityKg ?? offer.quantityKg;
          const agreedPrice = offer.middlemanId ? offer.pricePerKg : offer.counterPricePerKg ?? offer.pricePerKg;
          if (!match || match.listing.status !== "available" || match.listing.availableQuantityKg < agreedQuantity) throw new Error("Not enough available harvest remains to accept this offer.");
          offer.status = "accepted"; offer.pricePerKg = agreedPrice; offer.quantityKg = agreedQuantity;
          offerHistory(offer, "accepted", identity.id, "Farmer accepted the buyer's offer. Coordinate directly; any sale takes place outside CassavaLink.");
          pushNotification(state, buyerId, "Offer accepted", `Your offer for ${agreedQuantity.toLocaleString()} kg was accepted. Contact the farmer to coordinate directly.`, "offer");
          return offer;
        }
        if (decision === "reject") {
          if (identity.role !== "farmer" || identity.id !== offer.farmerId) throw new Error("403:Only the listed farmer can reject this offer.");
          offer.status = "rejected"; offerHistory(offer, "rejected", identity.id, "Farmer rejected the offer.");
          pushNotification(state, buyerId, "Offer declined", `Your offer ${offer.id} was declined by the farmer.`, "offer");
          return offer;
        }
        if (decision === "counter") {
          if (identity.role !== "farmer" || identity.id !== offer.farmerId) throw new Error("403:Only the listed farmer can counter this offer.");
          const price = numeric(payload.pricePerKg, 1, 100_000); const quantity = numeric(payload.quantityKg, 1, 1_000_000);
          const listing = state.listings.find((item) => item.id === offer.listingId);
          if (!price || !quantity || !listing || quantity > listing.availableQuantityKg) throw new Error("Counter price and quantity must be valid and within the available harvest.");
          offer.counterPricePerKg = price; offer.counterQuantityKg = quantity; offer.status = "countered";
          offerHistory(offer, "countered", identity.id, `Farmer countered at ${price} LAK/kg for ${quantity} kg.`);
          pushNotification(state, buyerId, "Farmer sent a counteroffer", `Counteroffer: ${price.toLocaleString()} LAK/kg for ${quantity.toLocaleString()} kg.`, "offer");
          return offer;
        }
        if (decision === "withdraw") {
          const ownerRole = offer.middlemanId ? "middleman" : "factory";
          const ownerId = offer.middlemanId ?? offer.factoryId;
          if (identity.role !== ownerRole || identity.id !== ownerId) throw new Error("403:Only the buyer who submitted this offer can withdraw it.");
          offer.status = "withdrawn"; offerHistory(offer, "withdrawn", identity.id, "Buyer withdrew its offer.");
          return offer;
        }
        if (decision === "accept-counter") {
          if (offer.middlemanId) throw new Error("Middleman purchases cannot accept negotiated prices.");
          const ownerRole = offer.middlemanId ? "middleman" : "factory";
          const ownerId = offer.middlemanId ?? offer.factoryId;
          if (identity.role !== ownerRole || identity.id !== ownerId || offer.status !== "countered") throw new Error("403:Only the buyer who submitted this offer can accept the counteroffer.");
          const match = listingWithFarm(state, offer.listingId);
          const quantity = offer.counterQuantityKg; const price = offer.counterPricePerKg;
          if (!match || !quantity || !price || match.listing.availableQuantityKg < quantity) throw new Error("The counteroffer quantity is no longer available.");
          offer.status = "accepted"; offer.quantityKg = quantity; offer.pricePerKg = price;
          offerHistory(offer, "accepted", identity.id, "Factory accepted the farmer's offer. Coordinate directly; any sale takes place outside CassavaLink.");
          pushNotification(state, offer.farmerId, "Counteroffer accepted", "The buyer accepted your offer. Contact them to coordinate directly.", "offer");
          return offer;
        }
        throw new Error("Choose accept, reject, counter, or withdraw.");
      }
      if (action === "send-message") {
        const listingId = text(payload.listingId, 100) || null; const recipientId = text(payload.recipientId, 100); const content = text(payload.content, 1000);
        const message: DemoMessage = { id: `message-${crypto.randomUUID()}`, senderId: identity.id, recipientId, listingId, content, createdAt: now };
        if (!content || (identity.role !== "farmer" && identity.role !== "factory" && identity.role !== "middleman")) throw new Error("Sign in as a farmer, factory, or middleman and write a message.");
        const targetListing = listingId ? state.listings.find((listing) => listing.id === listingId) : undefined;
        if (listingId && !targetListing) throw new Error("Listing not found.");
        const middlemanRecipient = state.accounts.some((account) => account.id === recipientId && account.role === "middleman" && account.status === "Approved") || recipientId === DEMO_ACCOUNTS.middleman.id;
        const farmerRecipient = state.farms.some((farm) => farm.farmerId === recipientId) || state.accounts.some((account) => account.id === recipientId && account.role === "farmer" && account.status === "Approved");
        const factoryRecipient = state.factoryProfiles.some((factory) => factory.id === recipientId);
        if (identity.role === "farmer" && !factoryRecipient && !middlemanRecipient) throw new Error("Choose a verified factory or approved middleman participant.");
        if (identity.role === "factory" && !farmerRecipient && !middlemanRecipient) throw new Error("Choose a farmer or approved middleman participant.");
        if (identity.role === "middleman" && !farmerRecipient && !factoryRecipient) throw new Error("Choose a farmer or factory participant.");
        if (targetListing && targetListing.farmerId !== (identity.role === "farmer" ? identity.id : recipientId)) throw new Error("This listing is not part of your conversation with that participant.");
        state.messages.unshift(message); pushNotification(state, recipientId, "New message", content.slice(0, 100), "message");
        return message;
      }
      if (action === "mark-notification-read") {
        const notification = state.notifications.find((item) => item.id === payload.id && item.userId === identity.id);
        if (!notification) throw new Error("Notification not found.");
        notification.readAt = now; return notification;
      }
      if (action === "approve-account" || action === "reject-account") {
        if (identity.role !== "admin") throw new Error("403:Administrator access is required to review accounts.");
        const account = state.accounts.find((item) => item.id === payload.accountId);
        if (!account) throw new Error("Account not found.");
        if (account.id === identity.id) throw new Error("403:Administrators cannot change their own account status.");
        if (account.status !== "Pending Admin Approval") throw new Error("Only verified registrations awaiting admin review can be approved or rejected.");
        account.status = action === "approve-account" ? "Approved" : "Rejected";
        account.rejectionReason = action === "reject-account" ? text(payload.reason, 400) || null : null;
        if (account.status === "Approved" && account.role === "factory" && !state.factoryProfiles.some((factory) => factory.id === account.id)) {
          state.factoryProfiles.push({ id: account.id, name: account.name, province: "Not provided", district: "Not provided", verified: false, capacityTonnes: 1 });
        }
        return publicAccount(account);
      }
      if (action === "set-official-price") {
        if (identity.role !== "factory") throw new Error("403:Only a factory can set an official buying price.");
        const factory = state.factoryProfiles.find((item) => item.id === identity.id);
        if (!factory?.verified) throw new Error("This factory must be verified before setting an official buying price.");
        const province = text(payload.province, 80) || factory.province;
        const district = text(payload.district, 80) || factory.district;
        const grade = payload.grade === "A" || payload.grade === "C" ? payload.grade : payload.grade === "B" ? "B" : null;
        const pricePerKg = numeric(payload.pricePerKg, 1, 100_000);
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        if (!province || !district || !grade || !pricePerKg) throw new Error("Province, district, grade, and a valid daily price are required.");
        let price = state.prices.find((item) =>
          item.priceType === "official" &&
          item.factoryId === identity.id &&
          item.province === province &&
          item.district === district &&
          item.grade === grade &&
          item.effectiveDate === today,
        );
        if (price) {
          price.pricePerKg = pricePerKg;
        } else {
          price = {
            id: `official-${crypto.randomUUID()}`,
            province,
            district,
            grade,
            pricePerKg,
            source: `Official factory daily price · ${factory.name} (prototype)`,
            effectiveDate: today,
            priceType: "official",
            factoryId: identity.id,
          };
          state.prices.unshift(price);
        }
        return price;
      }
      if (action === "save-price") {
        if (identity.role !== "admin") throw new Error("403:Administrator access is required to manage reference prices.");
        const province = text(payload.province, 80); const district = text(payload.district, 80); const source = text(payload.source, 140); const pricePerKg = numeric(payload.pricePerKg, 1, 100_000);
        if (!province || !district || !source || !pricePerKg) throw new Error("Province, district, source, and a valid price are required.");
        const price: DemoPrice = { id: `price-${crypto.randomUUID()}`, province, district, grade: payload.grade === "A" || payload.grade === "C" ? payload.grade : "B", pricePerKg, source, effectiveDate: text(payload.effectiveDate, 20) || new Date().toISOString().slice(0, 10) };
        state.prices.unshift(price); return price;
      }
      if (action === "update-price") {
        if (identity.role !== "admin") throw new Error("403:Administrator access is required to edit reference prices.");
        const price = state.prices.find((item) => item.id === payload.id);
        const pricePerKg = numeric(payload.pricePerKg, 1, 100_000);
        if (!price || price.priceType === "official" || !pricePerKg) throw new Error("Choose an existing regional reference price and enter a valid amount.");
        price.pricePerKg = pricePerKg;
        if (payload.province !== undefined) price.province = text(payload.province, 80) || price.province;
        if (payload.district !== undefined) price.district = text(payload.district, 80) || price.district;
        if (payload.source !== undefined) price.source = text(payload.source, 140) || price.source;
        if (payload.effectiveDate !== undefined) price.effectiveDate = text(payload.effectiveDate, 20) || price.effectiveDate;
        return price;
      }
      if (action === "update-factory-verification") {
        if (identity.role !== "admin") throw new Error("403:Administrator access is required to verify factories.");
        const factory = state.factoryProfiles.find((item) => item.id === payload.factoryId);
        if (!factory) throw new Error("Factory profile not found.");
        if (typeof payload.verified !== "boolean") throw new Error("Choose approve or unverify.");
        factory.verified = payload.verified;
        return factory;
      }
      if (action === "update-profile") {
        if (identity.role !== "factory") throw new Error("403:Factory access is required.");
        const name = text(payload.name, 100); const location = text(payload.location, 160); const [districtFromLocation, ...provinceParts] = location.split(","); const province = text(payload.province, 80) || text(provinceParts.join(","), 80); const district = text(payload.district, 80) || text(districtFromLocation, 80); const capacity = numeric(payload.capacityTonnes, 1, 10_000);
        if (!name || !province || !district || !capacity) throw new Error("Enter company name, province, district, and processing capacity.");
        const factory = state.factoryProfiles.find((item) => item.id === identity.id);
        if (!factory) throw new Error("Factory profile not found.");
        factory.name = name; factory.province = province; factory.district = district; factory.capacityTonnes = capacity;
        return factory;
      }
      throw new Error("Unknown action.");
    });
    return NextResponse.json({ data: result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The request could not be completed.";
    const status = message.startsWith("403:") ? 403 : message.includes("not found") ? 404 : 400;
    return error(message.replace(/^403:/, ""), status);
  }
}

function dateAfter(days: number) {
  const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10);
}
