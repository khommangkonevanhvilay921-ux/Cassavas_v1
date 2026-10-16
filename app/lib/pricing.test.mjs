import assert from "node:assert/strict";
import test from "node:test";
import { calculatePrice, getOfficialPrice } from "./pricing.ts";

test("calculates the example farmer net amount using integer LAK", () => {
  const result = calculatePrice({
    pricePerKg: 1600,
    quantityKg: 10000,
    transportArrangement: "farmer-delivery",
    transportationCost: 1000000,
  });

  assert.deepEqual(result, {
    grossAmount: 16000000,
    farmerTransportCost: 1000000,
    deductions: 0,
    netAmount: 15000000,
    netPricePerKg: 1500,
  });
});

test("factory pickup leaves farmer-paid transport at zero", () => {
  const result = calculatePrice({
    pricePerKg: 1600,
    quantityKg: 10000,
    transportArrangement: "factory-pickup",
    transportationCost: 750000,
  });

  assert.equal(result.farmerTransportCost, 0);
  assert.equal(result.netAmount, 16000000);
});

test("shared costs round up the farmer share and include deductions", () => {
  const result = calculatePrice({
    pricePerKg: 1575,
    quantityKg: 1000,
    transportArrangement: "shared",
    transportationCost: 1000001,
    deductions: 50000,
  });

  assert.equal(result.farmerTransportCost, 500001);
  assert.equal(result.netAmount, 1024999);
  assert.equal(result.netPricePerKg, 1024);
});

test("zero quantity produces a zero per-kilogram estimate", () => {
  const result = calculatePrice({
    pricePerKg: 1600,
    quantityKg: 0,
    transportArrangement: "factory-pickup",
    transportationCost: 0,
  });

  assert.equal(result.netPricePerKg, 0);
});

test("official price lookup prefers an exact district and ignores future prices", () => {
  const prices = [
    { id: "province", province: "Bolikhamxay", district: "Viengthong", grade: "B", pricePerKg: 1500, effectiveDate: "2026-10-15", priceType: "official" },
    { id: "district-old", province: "Bolikhamxay", district: "Pakkading", grade: "B", pricePerKg: 1550, effectiveDate: "2026-10-14", priceType: "official" },
    { id: "district-new", province: "Bolikhamxay", district: "Pakkading", grade: "B", pricePerKg: 1600, effectiveDate: "2026-10-16", priceType: "official" },
    { id: "district-future", province: "Bolikhamxay", district: "Pakkading", grade: "B", pricePerKg: 1700, effectiveDate: "2026-10-17", priceType: "official" },
    { id: "reference", province: "Bolikhamxay", district: "Pakkading", grade: "B", pricePerKg: 1800, effectiveDate: "2026-10-16", priceType: "reference" },
  ];

  assert.equal(getOfficialPrice(prices, "Bolikhamxay", "Pakkading", "B", "2026-10-16")?.id, "district-new");
  assert.equal(getOfficialPrice(prices, "Bolikhamxay", "Other", "B", "2026-10-16")?.id, "district-new");
  assert.equal(getOfficialPrice(prices, "Bolikhamxay", "Pakkading", "A", "2026-10-16"), null);
});