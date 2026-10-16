import type { DemoPrice } from "@/app/lib/demo-types";

export type PriceBreakdown = {
  grossAmount: number;
  farmerTransportCost: number;
  deductions: number;
  netAmount: number;
  netPricePerKg: number;
};

export function calculatePrice(input: {
  pricePerKg: number;
  quantityKg: number;
  transportArrangement: "factory-pickup" | "farmer-delivery" | "shared";
  transportationCost: number;
  deductions?: number;
}): PriceBreakdown {
  const { pricePerKg, quantityKg, transportArrangement, transportationCost } = input;
  const deductions = input.deductions ?? 0;
  const grossAmount = Math.round(pricePerKg) * Math.round(quantityKg);
  const farmerTransportCost = transportArrangement === "factory-pickup"
    ? 0
    : transportArrangement === "farmer-delivery"
      ? Math.round(transportationCost)
      : Math.ceil(Math.round(transportationCost) / 2);
  const netAmount = Math.max(0, grossAmount - farmerTransportCost - Math.round(deductions));

  return {
    grossAmount,
    farmerTransportCost,
    deductions: Math.round(deductions),
    netAmount,
    netPricePerKg: quantityKg > 0 ? Math.floor(netAmount / quantityKg) : 0,
  };
}

export function formatLak(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} LAK`;
}

export function getOfficialPrice(
  prices: DemoPrice[],
  province: string,
  district: string,
  grade: DemoPrice["grade"],
  asOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
): DemoPrice | null {
  const candidates = prices.filter((price) =>
    price.priceType === "official" &&
    price.grade === grade &&
    price.effectiveDate <= asOf &&
    price.province.localeCompare(province, undefined, { sensitivity: "accent" }) === 0,
  );
  const districtPrices = candidates.filter((price) =>
    price.district.localeCompare(district, undefined, { sensitivity: "accent" }) === 0,
  );
  const selected = districtPrices.length ? districtPrices : candidates;
  return selected.sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0] ?? null;
}
