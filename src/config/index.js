// The only module allowed to read process.env.
// Environment variables are loaded by Node itself (--env-file-if-exists in the
// npm scripts), so by the time this file runs they are already in process.env.
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535),
  // Not z.url(): it uses the WHATWG URL parser, which rejects the multi-host
  // "legacy" Atlas string (mongodb://host1:27017,host2:27017,.../db).
  // Only the scheme is checked here; the driver validates the rest on connect.
  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb(\+srv)?:\/\/\S+$/,
      'must be a mongodb:// or mongodb+srv:// connection string',
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print only the key and the reason. Never print the received values,
  // because they may be secrets (for example a database password).
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  db: Object.freeze({
    uri: env.MONGODB_URI,
  }),
});
