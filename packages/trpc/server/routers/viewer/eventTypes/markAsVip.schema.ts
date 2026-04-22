import { z } from "zod";

export const ZMarkAsVipInputSchema = z.object({
  id: z.number(),
  isVip: z.boolean(),
});

export type TMarkAsVipInputSchema = z.infer<typeof ZMarkAsVipInputSchema>;
