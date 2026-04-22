import { TRPCError } from "@trpc/server";

import { prisma } from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../types";
import type { TMarkAsVipInputSchema } from "./markAsVip.schema";

type MarkAsVipOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TMarkAsVipInputSchema;
};

export const markAsVipHandler = async ({ ctx, input }: MarkAsVipOptions) => {
  const { id, isVip } = input;

  const eventType = await prisma.eventType.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!eventType || eventType.userId !== ctx.user.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return prisma.eventType.update({
    where: { id },
    data: { isVip },
    select: { id: true, isVip: true },
  });
};
