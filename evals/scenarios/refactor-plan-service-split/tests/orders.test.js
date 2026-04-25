import { describe, expect, it } from "vitest";
import { calcTotal } from "../src/services/order-total.js";

describe("calcTotal", () => {
  it("adds item prices", () => {
    expect(calcTotal([{ priceCents: 100 }, { priceCents: 250 }])).toBe(350);
  });
});
