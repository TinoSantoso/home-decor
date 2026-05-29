import 'dotenv/config'
import type { Env } from 'prisma/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 requires the datasource URL to be in prisma.config.ts, NOT in schema.prisma.
// The url and directUrl fields in schema.prisma are no longer supported.
export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
    directUrl: env<Env>('DIRECT_URL'),
  },
})