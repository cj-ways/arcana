export function calculateFraudScore(customer, items) {
  if (!customer?.email) return 90;
  return items.length > 5 ? 75 : 15;
}
