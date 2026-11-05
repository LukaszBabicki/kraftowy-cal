import { ErrorWithCode } from "@calcom/lib/errors";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePrivateNoteHandler,
  getPrivateNoteHandler,
  upsertPrivateNoteHandler,
} from "./privateNote.handler";

const svc = vi.hoisted(() => ({ get: vi.fn(), upsert: vi.fn(), delete: vi.fn() }));
vi.mock("@calcom/features/bookings/services/BookingPrivateNoteService", () => ({
  BookingPrivateNoteService: vi.fn(function () {
    return svc;
  }),
}));
vi.mock("@calcom/prisma", () => ({ prisma: {} }));

const ctx = { user: { id: 7, email: "a@example.com" } } as never;

describe("private note handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives the actor from the session, never from input", async () => {
    svc.upsert.mockResolvedValue({ text: "x" });
    await upsertPrivateNoteHandler({ ctx, input: { bookingUid: "u", text: "x", userId: 99 } as never });
    expect(svc.upsert).toHaveBeenCalledWith({
      user: { id: 7, email: "a@example.com" },
      bookingUid: "u",
      text: "x",
      userId: 99,
    });
    // the service signature ignores unknown keys; the actor is always ctx.user
    expect(svc.upsert.mock.calls[0][0].user.id).toBe(7);
  });

  it.each([
    ["Forbidden", "FORBIDDEN"],
    ["NotFound", "NOT_FOUND"],
    ["BadRequest", "BAD_REQUEST"],
    ["InternalServerError", "INTERNAL_SERVER_ERROR"],
  ] as const)("maps %s to TRPC %s", async (factory, trpcCode) => {
    svc.get.mockRejectedValue(ErrorWithCode.Factory[factory]("msg"));
    const err = await getPrivateNoteHandler({ ctx, input: { bookingUid: "u" } }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect(err.code).toBe(trpcCode);
  });

  it("maps errors for delete as well", async () => {
    svc.delete.mockRejectedValue(ErrorWithCode.Factory.Forbidden("no"));
    const err = await deletePrivateNoteHandler({ ctx, input: { bookingUid: "u" } }).catch((e) => e);
    expect(err.code).toBe("FORBIDDEN");
  });
});
