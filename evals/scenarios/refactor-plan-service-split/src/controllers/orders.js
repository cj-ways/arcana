import { calcTotal } from "../services/order-total.js";

export function summarizeOrder(items) {
  return {
    totalCents: calcTotal(items),
  };
}
