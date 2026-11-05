import { BookingPrivateNoteService } from "@calcom/features/bookings/services/BookingPrivateNoteService";
import { prisma } from "@calcom/prisma";
import { convertErrorWithCodeToTRPCError } from "../../../lib/toTRPCError";
import type { TrpcSessionUser } from "../../../types";
import type {
  TDeletePrivateNoteInputSchema,
  TGetPrivateNoteInputSchema,
  TUpsertPrivateNoteInputSchema,
} from "./privateNote.schema";

type Ctx = { user: NonNullable<TrpcSessionUser> };

const actorOf = (ctx: Ctx) => ({ id: ctx.user.id, email: ctx.user.email });

// The shared errorConversionMiddleware does not catch errors thrown inside procedures (tRPC's `next()` returns
// a result instead of throwing), so ErrorWithCode would surface as a 500. Convert explicitly to keep
// 403/404/400 semantics, which the UI relies on.
const withTrpcErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    throw convertErrorWithCodeToTRPCError(e);
  }
};

export const getPrivateNoteHandler = async ({
  ctx,
  input,
}: {
  ctx: Ctx;
  input: TGetPrivateNoteInputSchema;
}) =>
  withTrpcErrors(() =>
    new BookingPrivateNoteService(prisma).get({ user: actorOf(ctx), bookingUid: input.bookingUid })
  );

export const upsertPrivateNoteHandler = async ({
  ctx,
  input,
}: {
  ctx: Ctx;
  input: TUpsertPrivateNoteInputSchema;
}) => withTrpcErrors(() => new BookingPrivateNoteService(prisma).upsert({ user: actorOf(ctx), ...input }));

export const deletePrivateNoteHandler = async ({
  ctx,
  input,
}: {
  ctx: Ctx;
  input: TDeletePrivateNoteInputSchema;
}) =>
  withTrpcErrors(() =>
    new BookingPrivateNoteService(prisma).delete({ user: actorOf(ctx), bookingUid: input.bookingUid })
  );
