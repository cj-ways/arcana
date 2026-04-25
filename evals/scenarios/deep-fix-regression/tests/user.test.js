import { describe, expect, it } from "vitest";
import { getPrimaryEmail } from "../src/user.js";

describe("getPrimaryEmail", () => {
  it("returns the first email in lowercase", () => {
    expect(getPrimaryEmail({ emails: ["FIRST@EXAMPLE.COM"] })).toBe("first@example.com");
  });
});
