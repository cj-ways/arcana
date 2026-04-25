export function calcTotal(items) {
  return items.reduce((sum, item) => sum + item.priceCents, 0);
}
