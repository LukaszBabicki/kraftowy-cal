import { ErrorCode } from "@calcom/lib/errorCodes";
import type { PrismaClient } from "@calcom/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOKING_PRIVATE_NOTE_MAX_LENGTH } from "../lib/privateNotes/constants";
import { BookingPrivateNoteService } from "./BookingPrivateNoteService";

const prismaMock = {
  booking: { findUnique: vi.fn() },
  bookingPrivateNote: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
};
const service = () => new BookingPrivateNoteService(prismaMock as unknown as PrismaClient);

const organizer = { id: 1, email: "org@example.com" };
const attendeeUser = { id: 2, email: "Guest@Example.com" };
const stranger = { id: 3, email: "admin@example.com" };
const booking = { id: 10, userId: 1, attendees: [{ email: "guest@example.com" }] };

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

describe("BookingPrivateNoteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.booking.findUnique.mockResolvedValue(booking);
  });

  it("throws NotFound for a missing booking", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);
    expect(await codeOf(service().get({ user: organizer, bookingUid: "x" }))).toBe(ErrorCode.NotFound);
    expect(prismaMock.bookingPrivateNote.findUnique).not.toHaveBeenCalled();
  });

  it("throws Forbidden for a non-participant on every operation", async () => {
    const s = service();
    expect(await codeOf(s.get({ user: stranger, bookingUid: "x" }))).toBe(ErrorCode.Forbidden);
    expect(await codeOf(s.upsert({ user: stranger, bookingUid: "x", text: "a" }))).toBe(ErrorCode.Forbidden);
    expect(await codeOf(s.delete({ user: stranger, bookingUid: "x" }))).toBe(ErrorCode.Forbidden);
    expect(prismaMock.bookingPrivateNote.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.bookingPrivateNote.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bookingPrivateNote.deleteMany).not.toHaveBeenCalled();
  });

  it("does not treat a booking without organizer as owned by anyone", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({ ...booking, userId: null });
    expect(await codeOf(service().get({ user: stranger, bookingUid: "x" }))).toBe(ErrorCode.Forbidden);
  });

  it("allows organizer and attendee (case-insensitive email) and scopes queries by the actor id", async () => {
    prismaMock.bookingPrivateNote.findUnique.mockResolvedValue(null);
    await service().get({ user: organizer, bookingUid: "x" });
    expect(prismaMock.bookingPrivateNote.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { bookingId_userId: { bookingId: 10, userId: 1 } } })
    );
    await service().get({ user: attendeeUser, bookingUid: "x" });
    expect(prismaMock.bookingPrivateNote.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { bookingId_userId: { bookingId: 10, userId: 2 } } })
    );
  });

  it("trims and saves text", async () => {
    prismaMock.bookingPrivateNote.upsert.mockResolvedValue({ text: "hi", updatedAt: new Date() });
    await service().upsert({ user: organizer, bookingUid: "x", text: "  hi  " });
    expect(prismaMock.bookingPrivateNote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { bookingId: 10, userId: 1, text: "hi" }, update: { text: "hi" } })
    );
  });

  it.each([
    ["", "empty"],
    ["   \n\t", "whitespace"],
    ["a".repeat(BOOKING_PRIVATE_NOTE_MAX_LENGTH + 1), "too long"],
  ])("rejects invalid text (%#: %s)", async (text) => {
    expect(await codeOf(service().upsert({ user: organizer, bookingUid: "x", text }))).toBe(
      ErrorCode.BadRequest
    );
    expect(prismaMock.bookingPrivateNote.upsert).not.toHaveBeenCalled();
  });

  it("accepts text of exactly the maximum length", async () => {
    prismaMock.bookingPrivateNote.upsert.mockResolvedValue({ text: "", updatedAt: new Date() });
    await service().upsert({
      user: organizer,
      bookingUid: "x",
      text: "a".repeat(BOOKING_PRIVATE_NOTE_MAX_LENGTH),
    });
    expect(prismaMock.bookingPrivateNote.upsert).toHaveBeenCalled();
  });

  it("maps database write errors to a generic InternalServerError", async () => {
    prismaMock.bookingPrivateNote.upsert.mockRejectedValue(new Error("secret db detail"));
    const err = await service()
      .upsert({ user: organizer, bookingUid: "x", text: "a" })
      .catch((e) => e);
    expect(err.code).toBe(ErrorCode.InternalServerError);
    expect(err.message).not.toContain("secret");
  });

  it("maps database delete errors to InternalServerError", async () => {
    prismaMock.bookingPrivateNote.deleteMany.mockRejectedValue(new Error("boom"));
    expect(await codeOf(service().delete({ user: organizer, bookingUid: "x" }))).toBe(
      ErrorCode.InternalServerError
    );
  });

  it("delete is idempotent", async () => {
    prismaMock.bookingPrivateNote.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.bookingPrivateNote.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(await service().delete({ user: organizer, bookingUid: "x" })).toEqual({ deleted: true });
    expect(await service().delete({ user: organizer, bookingUid: "x" })).toEqual({ deleted: false });
  });
});

describe("BookingPrivateNoteService read errors", () => {
  it("maps database read errors to a generic InternalServerError", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(booking);
    prismaMock.bookingPrivateNote.findUnique.mockRejectedValue(new Error("prisma secret"));
    const err = await service()
      .get({ user: organizer, bookingUid: "x" })
      .catch((e) => e);
    expect(err.code).toBe(ErrorCode.InternalServerError);
    expect(err.message).not.toContain("secret");
  });
});
