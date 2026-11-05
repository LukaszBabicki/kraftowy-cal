import { describe, expect, it } from "vitest";
import { ZGetPrivateNoteInputSchema, ZUpsertPrivateNoteInputSchema } from "./privateNote.schema";

describe("private note schemas", () => {
  it("trims text and accepts valid input", () => {
    expect(ZUpsertPrivateNoteInputSchema.parse({ bookingUid: "u", text: "  ok " }).text).toBe("ok");
  });
  it("rejects empty, whitespace-only and too long text", () => {
    for (const text of ["", "   ", "x".repeat(5001)]) {
      expect(ZUpsertPrivateNoteInputSchema.safeParse({ bookingUid: "u", text }).success).toBe(false);
    }
  });
  it("rejects a missing/empty bookingUid and ignores a smuggled userId", () => {
    expect(ZGetPrivateNoteInputSchema.safeParse({ bookingUid: "" }).success).toBe(false);
    expect(ZGetPrivateNoteInputSchema.safeParse({}).success).toBe(false);
    expect(ZGetPrivateNoteInputSchema.parse({ bookingUid: "u", userId: 5 })).toEqual({ bookingUid: "u" });
  });
});
