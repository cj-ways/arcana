import { describe, expect, it } from "vitest";
import { canActivateInvite } from "../src/invites/service.ts";

describe("canActivateInvite", () => {
  it("requires approval and seat availability", () => {
    expect(canActivateInvite({ approvalState: "pending", seatAvailable: true })).toBe(false);
    expect(canActivateInvite({ approvalState: "approved", seatAvailable: true })).toBe(true);
  });
});
