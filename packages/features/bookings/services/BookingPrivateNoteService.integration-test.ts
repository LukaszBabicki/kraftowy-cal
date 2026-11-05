import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";
import { bookingDetailsSelect, bookingMinimalSelect } from "@calcom/prisma/selects/booking";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingPrivateNoteService } from "./BookingPrivateNoteService";

const ts = Date.now();
const mk = (n: string) => ({ username: `pn-${n}-${ts}`, email: `pn-${n}-${ts}@example.com`, name: n });
let owner: { id: number; email: string };
let guest: { id: number; email: string };
let admin: { id: number; email: string };
let bookingUid: string;
let bookingId: number;
const service = new BookingPrivateNoteService(prisma);

describe("BookingPrivateNoteService - integration (real DB)", () => {
  beforeAll(async () => {
    owner = await prisma.user.create({ data: mk("owner"), select: { id: true, email: true } });
    guest = await prisma.user.create({ data: mk("guest"), select: { id: true, email: true } });
    admin = await prisma.user.create({ data: mk("admin"), select: { id: true, email: true } });
    bookingUid = `pn-booking-${ts}`;
    const b = await prisma.booking.create({
      data: {
        uid: bookingUid,
        title: "Synthetic booking",
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        status: BookingStatus.ACCEPTED,
        userId: owner.id,
        attendees: { create: { name: "Guest", email: guest.email, timeZone: "UTC" } },
      },
    });
    bookingId = b.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { uid: bookingUid } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, guest.id, admin.id] } } });
  });

  it("persists, reads, updates and deletes a note", async () => {
    expect(await service.get({ user: owner, bookingUid })).toBeNull();
    await service.upsert({ user: owner, bookingUid, text: "first" });
    expect((await service.get({ user: owner, bookingUid }))?.text).toBe("first");
    await service.upsert({ user: owner, bookingUid, text: "second" });
    expect((await service.get({ user: owner, bookingUid }))?.text).toBe("second");
    expect(await prisma.bookingPrivateNote.count({ where: { bookingId, userId: owner.id } })).toBe(1);
    expect(await service.delete({ user: owner, bookingUid })).toEqual({ deleted: true });
    expect(await service.get({ user: owner, bookingUid })).toBeNull();
    expect(await service.delete({ user: owner, bookingUid })).toEqual({ deleted: false });
  });

  it("isolates notes between participants and denies outsiders", async () => {
    await service.upsert({ user: owner, bookingUid, text: "owner secret" });
    await service.upsert({ user: guest, bookingUid, text: "guest secret" });
    expect((await service.get({ user: owner, bookingUid }))?.text).toBe("owner secret");
    expect((await service.get({ user: guest, bookingUid }))?.text).toBe("guest secret");
    await expect(service.get({ user: admin, bookingUid })).rejects.toMatchObject({ code: "forbidden_error" });
    await expect(service.upsert({ user: admin, bookingUid, text: "x" })).rejects.toMatchObject({
      code: "forbidden_error",
    });
    await expect(service.delete({ user: admin, bookingUid })).rejects.toMatchObject({
      code: "forbidden_error",
    });
    // guest deleting does not touch the owner's note
    await service.delete({ user: guest, bookingUid });
    expect((await service.get({ user: owner, bookingUid }))?.text).toBe("owner secret");
  });

  it("returns not found for an unknown booking", async () => {
    await expect(service.get({ user: owner, bookingUid: "nope" })).rejects.toMatchObject({
      code: "not_found_error",
    });
  });

  it("does not leak note text through standard booking selects", async () => {
    await service.upsert({ user: owner, bookingUid, text: "TOP-SECRET-NOTE" });
    for (const select of [bookingMinimalSelect, bookingDetailsSelect]) {
      const b = await prisma.booking.findUnique({ where: { uid: bookingUid }, select });
      expect(JSON.stringify(b)).not.toContain("TOP-SECRET-NOTE");
    }
    const plain = await prisma.booking.findUnique({ where: { uid: bookingUid } });
    expect(JSON.stringify(plain)).not.toContain("TOP-SECRET-NOTE");
  });

  it("cascades note deletion with the booking and with the user", async () => {
    await service.upsert({ user: owner, bookingUid, text: "to be cascaded" });
    await prisma.booking.delete({ where: { uid: bookingUid } });
    expect(await prisma.bookingPrivateNote.count({ where: { bookingId } })).toBe(0);

    const tmpUser = await prisma.user.create({ data: mk("tmp"), select: { id: true, email: true } });
    const b2 = await prisma.booking.create({
      data: {
        uid: `pn-b2-${ts}`,
        title: "b2",
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        status: BookingStatus.ACCEPTED,
        userId: owner.id,
        attendees: { create: { name: "T", email: tmpUser.email, timeZone: "UTC" } },
      },
    });
    await service.upsert({ user: tmpUser, bookingUid: b2.uid, text: "tmp note" });
    await prisma.user.delete({ where: { id: tmpUser.id } });
    expect(await prisma.bookingPrivateNote.count({ where: { bookingId: b2.id } })).toBe(0);
    await prisma.booking.delete({ where: { id: b2.id } });
    bookingUid = `pn-booking-gone-${ts}`; // booking already removed; afterAll deleteMany is a no-op
  });
});
