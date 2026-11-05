import { ErrorWithCode } from "@calcom/lib/errors";
import logger from "@calcom/lib/logger";
import type { PrismaClient } from "@calcom/prisma";
import { BOOKING_PRIVATE_NOTE_MAX_LENGTH } from "../lib/privateNotes/constants";
import {
  type BookingPrivateNoteDto,
  BookingPrivateNoteRepository,
} from "../repositories/BookingPrivateNoteRepository";

const log = logger.getSubLogger({ prefix: ["BookingPrivateNoteService"] });

type Actor = { id: number; email: string };

/**
 * Private, per-user notes for a booking.
 *
 * Authorization is intentionally strict and independent from BookingAccessService: only participants
 * (organizer or attendee matching the user's primary email) may use notes, and rows are always scoped
 * by the authenticated user's id, so one user can never read or alter another user's note.
 */
export class BookingPrivateNoteService {
  private readonly repo: BookingPrivateNoteRepository;

  constructor(prismaClient: PrismaClient) {
    this.repo = new BookingPrivateNoteRepository(prismaClient);
  }

  private async getParticipatingBookingId({ user, bookingUid }: { user: Actor; bookingUid: string }) {
    const booking = await this.repo.findBookingForParticipation({ bookingUid });
    if (!booking) {
      throw ErrorWithCode.Factory.NotFound("Booking not found");
    }

    const userEmail = user.email.trim().toLowerCase();
    const isOrganizer = booking.userId !== null && booking.userId === user.id;
    const isAttendee = booking.attendees.some((a) => a.email.trim().toLowerCase() === userEmail);

    if (!isOrganizer && !isAttendee) {
      throw ErrorWithCode.Factory.Forbidden("You do not have permission to access notes of this booking");
    }
    return booking.id;
  }

  async get({
    user,
    bookingUid,
  }: {
    user: Actor;
    bookingUid: string;
  }): Promise<BookingPrivateNoteDto | null> {
    const bookingId = await this.getParticipatingBookingId({ user, bookingUid });
    try {
      return await this.repo.findByBookingAndUser({ bookingId, userId: user.id });
    } catch (error) {
      log.error("Failed to read private booking note", { bookingId, userId: user.id, error });
      throw ErrorWithCode.Factory.InternalServerError("Could not load the note");
    }
  }

  async upsert({
    user,
    bookingUid,
    text,
  }: {
    user: Actor;
    bookingUid: string;
    text: string;
  }): Promise<BookingPrivateNoteDto> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw ErrorWithCode.Factory.BadRequest("Note cannot be empty");
    }
    if (trimmed.length > BOOKING_PRIVATE_NOTE_MAX_LENGTH) {
      throw ErrorWithCode.Factory.BadRequest(
        `Note cannot be longer than ${BOOKING_PRIVATE_NOTE_MAX_LENGTH} characters`
      );
    }
    const bookingId = await this.getParticipatingBookingId({ user, bookingUid });
    try {
      return await this.repo.upsert({ bookingId, userId: user.id, text: trimmed });
    } catch (error) {
      log.error("Failed to save private booking note", { bookingId, userId: user.id, error });
      throw ErrorWithCode.Factory.InternalServerError("Could not save the note");
    }
  }

  async delete({ user, bookingUid }: { user: Actor; bookingUid: string }): Promise<{ deleted: boolean }> {
    const bookingId = await this.getParticipatingBookingId({ user, bookingUid });
    try {
      const deleted = await this.repo.deleteByBookingAndUser({ bookingId, userId: user.id });
      return { deleted };
    } catch (error) {
      log.error("Failed to delete private booking note", { bookingId, userId: user.id, error });
      throw ErrorWithCode.Factory.InternalServerError("Could not delete the note");
    }
  }
}
