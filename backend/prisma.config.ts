import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: 'postgresql://luxury_admin:LuxGar@2026!Secure@localhost:5433/luxury_garage_db',
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
