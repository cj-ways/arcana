export function createOrder(items) {
  return {
    status: "pending",
    itemCount: items.length,
  };
}
