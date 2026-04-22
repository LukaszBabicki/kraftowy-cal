# packages/prisma - local rules

## One schema.prisma, one migration per PR
- Schema change = `pnpm --filter @calcom/prisma prisma migrate dev --name descriptive-name`
- Never hand-edit files in `prisma/migrations/`
- Never delete old migrations - they are part of production history

## Explicit select for PII models (rule kept locally in this layer)
- User, Account, Credentials, Token - every query must use `select: { ... }`
- Forbidden: `prisma.user.findMany()` without select
- Forbidden: `prisma.user.findUnique({ where: { id } })` without select
- Why: prevents leaking password hashes, tokens and internal fields to callers

## Derived types
- Enum in Prisma = enum in code, do not duplicate in `types/*.ts`
- `@relation` definitions always use explicit FK fields
- Use `@map("column_name_in_db")` whenever the Prisma field name differs from the column name

## Seed
- `prisma/seed.ts` is deterministic and idempotent
- Add new seeds to the existing file, do not create separate ones