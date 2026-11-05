import type { PrismaClient } from "@calcom/prisma";

const noteSelect = { text: true, updatedAt: true } as const;

export type BookingPrivateNoteDto = { text: string; updatedAt: Date };

export class BookingPrivateNoteRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  /** Booking data needed to decide whether a user participates in a booking. */
  async findBookingForParticipation({ bookingUid }: { bookingUid: string }) {
    return this.prismaClient.booking.findUnique({
      where: { uid: bookingUid },
      select: {
        id: true,
        userId: true,
        attendees: { select: { email: true } },
      },
    });
  }

  async findByBookingAndUser({
    bookingId,
    userId,
  }: {
    bookingId: number;
    userId: number;
  }): Promise<BookingPrivateNoteDto | null> {
    return this.prismaClient.bookingPrivateNote.findUnique({
      where: { bookingId_userId: { bookingId, userId } },
      select: noteSelect,
    });
  }

  async upsert({
    bookingId,
    userId,
    text,
  }: {
    bookingId: number;
    userId: number;
    text: string;
  }): Promise<BookingPrivateNoteDto> {
    return this.prismaClient.bookingPrivateNote.upsert({
      where: { bookingId_userId: { bookingId, userId } },
      create: { bookingId, userId, text },
      update: { text },
      select: noteSelect,
    });
  }

  /** Returns true when a note existed and was removed. */
  async deleteByBookingAndUser({ bookingId, userId }: { bookingId: number; userId: number }) {
    const { count } = await this.prismaClient.bookingPrivateNote.deleteMany({
      where: { bookingId, userId },
    });
    return count > 0;
  }
}
