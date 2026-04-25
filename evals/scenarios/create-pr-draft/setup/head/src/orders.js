import { calculateFraudScore } from "./risk.js";

export function createOrder(items, customer) {
  const fraudScore = calculateFraudScore(customer, items);

  return {
    status: fraudScore > 70 ? "manual_review" : "pending",
    fraudScore,
    itemCount: items.length,
  };
}
