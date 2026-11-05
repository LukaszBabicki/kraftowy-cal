import { BOOKING_PRIVATE_NOTE_MAX_LENGTH } from "@calcom/features/bookings/lib/privateNotes/constants";
import { z } from "zod";

export const ZGetPrivateNoteInputSchema = z.object({
  bookingUid: z.string().min(1),
});
export type TGetPrivateNoteInputSchema = z.infer<typeof ZGetPrivateNoteInputSchema>;

export const ZUpsertPrivateNoteInputSchema = z.object({
  bookingUid: z.string().min(1),
  text: z
    .string()
    .trim()
    .min(1, "Note cannot be empty")
    .max(
      BOOKING_PRIVATE_NOTE_MAX_LENGTH,
      `Note cannot be longer than ${BOOKING_PRIVATE_NOTE_MAX_LENGTH} characters`
    ),
});
export type TUpsertPrivateNoteInputSchema = z.infer<typeof ZUpsertPrivateNoteInputSchema>;

export const ZDeletePrivateNoteInputSchema = z.object({
  bookingUid: z.string().min(1),
});
export type TDeletePrivateNoteInputSchema = z.infer<typeof ZDeletePrivateNoteInputSchema>;
