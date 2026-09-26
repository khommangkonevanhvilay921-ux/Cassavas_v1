import { NextResponse } from "next/server";
import { getDemoIdentity } from "@/app/lib/demo-session";
import { getDemoState, updateDemoState } from "@/app/lib/demo-store";
import { calculatePrice } from "@/app/lib/pricing";
import { type DemoAssessment, type DemoFarm, type DemoListing, type DemoMessage, type DemoNotification, type DemoOffer, type DemoPrice, type DemoRole, type DemoState, type DemoTransaction, type ListingStatus, type TransactionStatus } from "@/app/lib/demo-types";

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
    transactions: state.transactions,
    prices: state.prices,
    notifications: state.notifications,
    messages: state.messages,
    factories: state.factoryProfiles,
  };
}

function publicFarm(farm: DemoFarm) {
  return { id: farm.id, farmerId: farm.farmerId, name: farm.name, variety: farm.variety, areaHectares: farm.areaHectares, estimatedProductionKg: farm.estimatedProductionKg, expectedHarvestDate: farm.expectedHarvestDate, province: farm.province, district: farm.district, village: farm.village, photos: farm.photos, status: farm.status, createdAt: farm.createdAt };
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
    return NextResponse.json({ ...data, farms: state.farms.filter((farm) => farm.farmerId === identity.id).map(publicFarm), listings: state.listings.filter((listing) => listing.farmerId === identity.id), offers: state.offers.filter((offer) => offer.farmerId === identity.id), transactions: state.transactions.filter((transaction) => transaction.farmerId === identity.id), assessments: state.assessments.filter((assessment) => assessment.farmerId === identity.id), notifications: state.notifications.filter((notification) => notification.userId === identity.id), messages: state.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id) });
  }
  if (view === "factory") {
    if (identity?.role !== "factory" && identity?.role !== "admin") return error("Sign in to view factory records.", 403);
    return NextResponse.json({ ...data, farms: state.farms.map(publicFarm), assessments: state.assessments.map((assessment) => ({ id: assessment.id, farmerId: assessment.farmerId, grade: assessment.grade, damage: assessment.damage, foreignMaterial: assessment.foreignMaterial, confidence: assessment.confidence, provider: assessment.provider, createdAt: assessment.createdAt })), offers: state.offers.filter((offer) => offer.factoryId === identity.id), transactions: state.transactions.filter((transaction) => transaction.factoryId === identity.id), notifications: state.notifications.filter((notification) => notification.userId === identity.id), messages: state.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id) });
  }
  if (view === "admin") {
    if (identity?.role !== "admin") return error("Administrator access is required.", 403);
    return NextResponse.json(data);
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
        if (roleError(identity, "factory")) throw new Error("403:Factory access required to submit an offer.");
        const listingId = text(payload.listingId, 100); const match = listingWithFarm(state, listingId);
        const factory = state.factoryProfiles.find((item) => item.id === identity.id);
        const pricePerKg = numeric(payload.pricePerKg, 1, 100_000); const quantityKg = numeric(payload.quantityKg, 1, 1_000_000);
        if (!factory?.verified) throw new Error("This factory is not verified and cannot submit offers.");
        if (!match || match.listing.status !== "available" || match.listing.availableQuantityKg < 1) throw new Error("This harvest is no longer available.");
        if (!pricePerKg || !quantityKg || quantityKg > match.listing.availableQuantityKg) throw new Error("Enter a valid price and a quantity within the harvest's available amount.");
        const arrangement = payload.transportArrangement === "farmer-delivery" || payload.transportArrangement === "shared" ? payload.transportArrangement : "factory-pickup";
        const transportationCost = numeric(payload.transportationCost ?? 0, 0, 100_000_000);
        if (transportationCost === null) throw new Error("Enter a valid transportation cost.");
        const calculation = calculatePrice({ pricePerKg, quantityKg, transportArrangement: arrangement, transportationCost });
        const offer: DemoOffer = { id: `offer-${crypto.randomUUID()}`, listingId, farmerId: match.listing.farmerId, factoryId: identity.id, pricePerKg, quantityKg, transportArrangement: arrangement, transportationCost, farmerTransportCost: calculation.farmerTransportCost, pickupDate: text(payload.pickupDate, 20) || dateAfter(14), paymentTerms: text(payload.paymentTerms, 240) || "Payment within 2 business days after inspection", inspectionTerms: text(payload.inspectionTerms, 240) || "Visual quality inspection and weighbridge confirmation", expirationDate: text(payload.expirationDate, 20) || dateAfter(7), additionalConditions: text(payload.additionalConditions, 400), status: "pending", counterPricePerKg: null, counterQuantityKg: null, createdAt: now, updatedAt: now, history: [{ status: "pending", by: identity.id, note: "Offer submitted", at: now }] };
        state.offers.unshift(offer);
        pushNotification(state, offer.farmerId, "New buyer offer", `${factory.name} offered ${pricePerKg.toLocaleString()} LAK/kg for ${quantityKg.toLocaleString()} kg.`, "offer");
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
        if (offer.status !== "pending" && offer.status !== "countered") throw new Error("This offer can no longer be changed.");
        const todayInLaos = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        if (offer.expirationDate < todayInLaos) { offer.status = "expired"; throw new Error("This offer has expired."); }
        const decision = payload.decision;
        if (decision === "accept") {
          if (identity.role !== "farmer" || identity.id !== offer.farmerId) throw new Error("403:Only the listed farmer can accept this offer.");
          const match = listingWithFarm(state, offer.listingId);
          const agreedQuantity = offer.counterQuantityKg ?? offer.quantityKg;
          const agreedPrice = offer.counterPricePerKg ?? offer.pricePerKg;
          if (!match || match.listing.status !== "available" || match.listing.availableQuantityKg < agreedQuantity) throw new Error("Not enough available harvest remains to accept this offer.");
          match.listing.availableQuantityKg -= agreedQuantity;
          if (match.listing.availableQuantityKg === 0) match.listing.status = "sold";
          offer.status = "accepted"; offer.pricePerKg = agreedPrice; offer.quantityKg = agreedQuantity;
          offerHistory(offer, "accepted", identity.id, "Farmer accepted the offer; quantity reserved.");
          const calculation = calculatePrice({ pricePerKg: agreedPrice, quantityKg: agreedQuantity, transportArrangement: offer.transportArrangement, transportationCost: offer.transportationCost });
          const transaction: DemoTransaction = { id: `CL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, offerId: offer.id, listingId: offer.listingId, farmId: match.farm.id, farmerId: offer.farmerId, factoryId: offer.factoryId, quantityKg: agreedQuantity, finalWeightKg: null, pricePerKg: agreedPrice, finalGrade: null, transportationCost: offer.transportationCost, farmerTransportCost: calculation.farmerTransportCost, deductions: 0, grossAmount: calculation.grossAmount, netAmount: calculation.netAmount, paymentStatus: "pending", deliveryStatus: "Awaiting pickup", status: "OFFER_ACCEPTED", receiptConfirmed: false, disputeReason: null, createdAt: now, history: [{ status: "OFFER_ACCEPTED", by: identity.id, note: "Offer accepted. Payment remains pending until confirmed.", at: now }] };
          state.transactions.unshift(transaction);
          pushNotification(state, offer.factoryId, "Offer accepted", `Offer for ${agreedQuantity.toLocaleString()} kg was accepted. Transaction ${transaction.id} is ready.`, "transaction");
          return { offer, transaction };
        }
        if (decision === "reject") {
          if (identity.role !== "farmer" || identity.id !== offer.farmerId) throw new Error("403:Only the listed farmer can reject this offer.");
          offer.status = "rejected"; offerHistory(offer, "rejected", identity.id, "Farmer rejected the offer.");
          pushNotification(state, offer.factoryId, "Offer declined", `Your offer ${offer.id} was declined by the farmer.`, "offer");
          return offer;
        }
        if (decision === "counter") {
          if (identity.role !== "farmer" || identity.id !== offer.farmerId) throw new Error("403:Only the listed farmer can counter this offer.");
          const price = numeric(payload.pricePerKg, 1, 100_000); const quantity = numeric(payload.quantityKg, 1, 1_000_000);
          const listing = state.listings.find((item) => item.id === offer.listingId);
          if (!price || !quantity || !listing || quantity > listing.availableQuantityKg) throw new Error("Counter price and quantity must be valid and within the available harvest.");
          offer.counterPricePerKg = price; offer.counterQuantityKg = quantity; offer.status = "countered";
          offerHistory(offer, "countered", identity.id, `Farmer countered at ${price} LAK/kg for ${quantity} kg.`);
          pushNotification(state, offer.factoryId, "Farmer sent a counteroffer", `Counteroffer: ${price.toLocaleString()} LAK/kg for ${quantity.toLocaleString()} kg.`, "offer");
          return offer;
        }
        if (decision === "withdraw") {
          if (identity.role !== "factory" || identity.id !== offer.factoryId) throw new Error("403:Only the submitting factory can withdraw this offer.");
          offer.status = "withdrawn"; offerHistory(offer, "withdrawn", identity.id, "Factory withdrew its offer.");
          return offer;
        }
        if (decision === "accept-counter") {
          if (identity.role !== "factory" || identity.id !== offer.factoryId || offer.status !== "countered") throw new Error("403:Only the factory can accept this counteroffer.");
          const match = listingWithFarm(state, offer.listingId);
          const quantity = offer.counterQuantityKg; const price = offer.counterPricePerKg;
          if (!match || !quantity || !price || match.listing.availableQuantityKg < quantity) throw new Error("The counteroffer quantity is no longer available.");
          offer.status = "accepted"; offer.quantityKg = quantity; offer.pricePerKg = price;
          match.listing.availableQuantityKg -= quantity;
          if (match.listing.availableQuantityKg === 0) match.listing.status = "sold";
          offerHistory(offer, "accepted", identity.id, "Factory accepted counteroffer; quantity reserved.");
          const calculation = calculatePrice({ pricePerKg: price, quantityKg: quantity, transportArrangement: offer.transportArrangement, transportationCost: offer.transportationCost });
          const transaction: DemoTransaction = { id: `CL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, offerId: offer.id, listingId: offer.listingId, farmId: match.farm.id, farmerId: offer.farmerId, factoryId: offer.factoryId, quantityKg: quantity, finalWeightKg: null, pricePerKg: price, finalGrade: null, transportationCost: offer.transportationCost, farmerTransportCost: calculation.farmerTransportCost, deductions: 0, grossAmount: calculation.grossAmount, netAmount: calculation.netAmount, paymentStatus: "pending", deliveryStatus: "Awaiting pickup", status: "OFFER_ACCEPTED", receiptConfirmed: false, disputeReason: null, createdAt: now, history: [{ status: "OFFER_ACCEPTED", by: identity.id, note: "Counteroffer accepted; payment remains pending.", at: now }] };
          state.transactions.unshift(transaction);
          pushNotification(state, offer.farmerId, "Counteroffer accepted", `The factory accepted your offer. Transaction ${transaction.id} is ready.`, "transaction");
          return { offer, transaction };
        }
        throw new Error("Choose accept, reject, counter, or withdraw.");
      }
      if (action === "update-transaction") {
        const transaction = state.transactions.find((item) => item.id === payload.transactionId);
        if (!transaction) throw new Error("Transaction not found.");
        const isFarmer = identity.role === "farmer" && identity.id === transaction.farmerId;
        const isFactory = identity.role === "factory" && identity.id === transaction.factoryId;
        const requestedStatus = text(payload.status, 40) as TransactionStatus;
        const allowed: Record<string, string[]> = {
          OFFER_ACCEPTED: ["AWAITING_PICKUP", "CANCELLED"], AWAITING_PICKUP: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
          IN_TRANSIT: ["DELIVERED"], DELIVERED: ["INSPECTION_PENDING"], INSPECTION_PENDING: ["PAYMENT_PENDING"],
          PAYMENT_PENDING: ["PAYMENT_CONFIRMED"], PAYMENT_CONFIRMED: ["COMPLETED"],
        };
        if (payload.operation === "dispute") {
          if (!isFarmer && !isFactory) throw new Error("403:Only a transaction participant can report an issue.");
          const reason = text(payload.reason, 500); if (!reason) throw new Error("Describe the transaction issue.");
          transaction.status = "DISPUTED"; transaction.disputeReason = reason;
          transaction.history.unshift({ status: "DISPUTED", by: identity.id, note: reason, at: now });
          pushNotification(state, isFarmer ? transaction.factoryId : transaction.farmerId, "Transaction issue reported", `Transaction ${transaction.id} was flagged for review.`, "dispute");
          return transaction;
        }
        if (payload.operation === "resolve-dispute") {
          if (identity.role !== "admin" || transaction.status !== "DISPUTED") throw new Error("403:Only an administrator can resolve an open dispute.");
          const resolution = text(payload.resolution, 800);
          const outcome = payload.outcome === "cancelled" ? "CANCELLED" : "PAYMENT_PENDING";
          if (!resolution) throw new Error("Add a resolution note before closing the dispute.");
          if (outcome === "CANCELLED") {
            const listing = state.listings.find((item) => item.id === transaction.listingId);
            if (listing) { listing.availableQuantityKg += transaction.quantityKg; listing.status = "available"; }
          }
          transaction.status = outcome; transaction.deliveryStatus = statusLabel(outcome);
          transaction.disputeReason = `${transaction.disputeReason ?? "Issue"} · Resolution: ${resolution}`;
          transaction.history.unshift({ status: outcome, by: identity.id, note: `Admin resolution: ${resolution}`, at: now });
          pushNotification(state, transaction.farmerId, "Dispute resolution recorded", `Transaction ${transaction.id}: ${resolution}`, "dispute");
          pushNotification(state, transaction.factoryId, "Dispute resolution recorded", `Transaction ${transaction.id}: ${resolution}`, "dispute");
          return transaction;
        }
        if (payload.operation === "confirm-receipt") {
          if (!isFarmer || transaction.status !== "PAYMENT_CONFIRMED") throw new Error("403:Only the farmer can confirm receipt after payment is marked confirmed.");
          transaction.receiptConfirmed = true; transaction.status = "COMPLETED";
          transaction.history.unshift({ status: "COMPLETED", by: identity.id, note: "Farmer confirmed receipt. No payment transfer was performed by the demo.", at: now });
          return transaction;
        }
        if (payload.operation === "inspection") {
          if (!isFactory || (transaction.status !== "DELIVERED" && transaction.status !== "INSPECTION_PENDING")) throw new Error("403:Factory inspection can only be recorded after delivery.");
          const weight = numeric(payload.finalWeightKg, 1, transaction.quantityKg * 1.25);
          if (!weight) throw new Error("Enter the inspected weight in kilograms.");
          transaction.finalWeightKg = weight;
          transaction.finalGrade = payload.grade === "A" || payload.grade === "C" ? payload.grade : "B";
          const calculation = calculatePrice({ pricePerKg: transaction.pricePerKg, quantityKg: weight, transportArrangement: transaction.farmerTransportCost === 0 ? "factory-pickup" : "farmer-delivery", transportationCost: transaction.farmerTransportCost, deductions: numeric(payload.deductions ?? 0, 0, 100_000_000) ?? 0 });
          transaction.grossAmount = calculation.grossAmount; transaction.netAmount = calculation.netAmount; transaction.deductions = calculation.deductions;
          transaction.status = "PAYMENT_PENDING"; transaction.paymentStatus = "pending"; transaction.deliveryStatus = "Inspection complete";
          transaction.history.unshift({ status: "PAYMENT_PENDING", by: identity.id, note: `Inspection saved: ${weight} kg, grade ${transaction.finalGrade}.`, at: now });
          if (transaction.history[1]?.status !== "INSPECTION_PENDING") transaction.history.splice(1, 0, { status: "INSPECTION_PENDING", by: identity.id, note: "Inspection started after delivery.", at: now });
          pushNotification(state, transaction.farmerId, "Inspection recorded", `Final inspected quantity for ${transaction.id} is ${weight.toLocaleString()} kg.`, "transaction");
          return transaction;
        }
        if (payload.operation === "payment") {
          if (!isFactory || transaction.status !== "PAYMENT_PENDING") throw new Error("403:Only the factory can mark its payment status as confirmed after inspection.");
          transaction.paymentStatus = "confirmed"; transaction.status = "PAYMENT_CONFIRMED";
          transaction.history.unshift({ status: "PAYMENT_CONFIRMED", by: identity.id, note: "Factory marked payment confirmed. This demo does not transfer money.", at: now });
          pushNotification(state, transaction.farmerId, "Payment status updated", `The factory marked payment confirmed for ${transaction.id}. Confirm receipt after checking independently.`, "payment");
          return transaction;
        }
        if ((!isFactory && !isFarmer) || !allowed[transaction.status]?.includes(requestedStatus)) throw new Error("403:That transaction status change is not allowed.");
        if (isFarmer && requestedStatus !== "CANCELLED") throw new Error("403:Only the factory may update delivery progress.");
        if (isFactory && requestedStatus === "COMPLETED") throw new Error("The farmer must confirm receipt before completion.");
        if (requestedStatus === "CANCELLED") {
          if (transaction.status !== "OFFER_ACCEPTED" && transaction.status !== "AWAITING_PICKUP") throw new Error("This transaction can no longer be cancelled.");
          const listing = state.listings.find((item) => item.id === transaction.listingId);
          if (listing) { listing.availableQuantityKg += transaction.quantityKg; listing.status = "available"; }
          transaction.paymentStatus = "pending";
        }
        if (requestedStatus === "PAYMENT_CONFIRMED") throw new Error("Use the payment confirmation action after inspection.");
        transaction.status = requestedStatus; transaction.deliveryStatus = statusLabel(requestedStatus);
        transaction.history.unshift({ status: requestedStatus, by: identity.id, note: `Status updated to ${statusLabel(requestedStatus)}.`, at: now });
        pushNotification(state, isFarmer ? transaction.factoryId : transaction.farmerId, "Transaction updated", `${transaction.id}: ${statusLabel(requestedStatus)}.`, "transaction");
        return transaction;
      }
      if (action === "send-message") {
        const listingId = text(payload.listingId, 100) || null; const recipientId = text(payload.recipientId, 100); const content = text(payload.content, 1000);
        const message: DemoMessage = { id: `message-${crypto.randomUUID()}`, senderId: identity.id, recipientId, listingId, content, createdAt: now };
        if (!content || (identity.role !== "farmer" && identity.role !== "factory")) throw new Error("Sign in as a farmer or factory and write a message.");
        const targetListing = listingId ? state.listings.find((listing) => listing.id === listingId) : undefined;
        if (listingId && !targetListing) throw new Error("Listing not found.");
        if (identity.role === "farmer" && !state.factoryProfiles.some((factory) => factory.id === recipientId)) throw new Error("Choose a verified factory participant.");
        if (identity.role === "factory" && !state.farms.some((farm) => farm.farmerId === recipientId)) throw new Error("Choose a farmer participant.");
        if (targetListing && (targetListing.farmerId !== (identity.role === "farmer" ? identity.id : recipientId))) throw new Error("This listing is not part of your conversation with that participant.");
        state.messages.unshift(message); pushNotification(state, recipientId, "New message", content.slice(0, 100), "message");
        return message;
      }
      if (action === "mark-notification-read") {
        const notification = state.notifications.find((item) => item.id === payload.id && item.userId === identity.id);
        if (!notification) throw new Error("Notification not found.");
        notification.readAt = now; return notification;
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
        if (!price || !pricePerKg) throw new Error("Choose an existing price and enter a valid amount.");
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

function statusLabel(status: TransactionStatus) {
  return ({ OFFER_ACCEPTED: "Offer accepted", AWAITING_PICKUP: "Awaiting pickup", IN_TRANSIT: "In transit", DELIVERED: "Delivered", INSPECTION_PENDING: "Inspection pending", PAYMENT_PENDING: "Payment pending", PAYMENT_CONFIRMED: "Payment confirmed", COMPLETED: "Completed", DISPUTED: "Disputed", CANCELLED: "Cancelled" })[status];
}