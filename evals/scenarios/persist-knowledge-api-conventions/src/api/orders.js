export function serializeOrder(order) {
  return {
    orderId: order.id,
    accountName: order.accountName,
  };
}
