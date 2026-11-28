// The only module allowed to read process.env.
// Environment variables are loaded by Node itself (--env-file-if-exists in the
// npm scripts), so by the time this file runs they are already in process.env.
import { z } from 'zod';

const envSchema = z
  .object({
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
    // Comma-separated list of browser origins allowed to call the API, for example
    // "http://localhost:5173,https://shop.example.com". Empty = no cross-origin
    // browser access. A browser origin has no path and no trailing slash.
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .refine(
        (origins) =>
          origins.every(
            (origin) => origin === '*' || /^https?:\/\/[^/\s]+$/.test(origin),
          ),
        'each origin must look like http(s)://host[:port], with no path or trailing slash',
      ),
    // Maximum size of a JSON request body (bytes or a string such as "100kb").
    BODY_LIMIT: z.string().min(1).default('100kb'),
    // How many reverse proxies sit in front of the app (0 = none, the app is
    // reached directly). Express uses it to find the real client IP in
    // X-Forwarded-For. Never use "trust everything": clients could fake their IP.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    // bcrypt cost factor: each +1 doubles the hashing time (2^rounds iterations).
    // 10 is the OWASP minimum; 12 balances safety and login speed.
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

    // HMAC key for signing access tokens. RFC 7518 (3.2): an HS256 key must be
    // at least as long as the hash output, 256 bits = 32 bytes. Generate it
    // randomly (see .env.example); a short or guessable secret can be brute-forced
    // offline from any token, and then anyone can forge tokens.
    JWT_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters (256 bits for HS256)'),
    // Access token lifetime: a whole number followed by a unit (s, m, h, d),
    // for example "15m" or "1d". The unit is required on purpose: jsonwebtoken
    // reads a string without a unit as milliseconds ("120" = 120 ms), and every
    // env value is a string, so a bare number would create tokens that expire
    // almost immediately.
    JWT_EXPIRES_IN: z
      .string()
      .regex(
        /^[1-9]\d*[smhd]$/,
        'must be a number followed by s, m, h or d (for example 15m or 1d)',
      ),
  })
  // Allowing every origin is acceptable on a developer machine only.
  .refine(
    (env) => !(env.NODE_ENV === 'production' && env.CORS_ORIGINS.includes('*')),
    {
      path: ['CORS_ORIGINS'],
      message: 'must not contain * in production',
    },
  );

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
  cors: Object.freeze({
    origins: Object.freeze(env.CORS_ORIGINS),
  }),
  bodyLimit: env.BODY_LIMIT,
  trustProxyHops: env.TRUST_PROXY_HOPS,
  bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
  jwt: Object.freeze({
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    // Fixed in code, not in env: signing and verifying must use the same
    // algorithm, and verify() must be told to accept only this one.
    algorithm: 'HS256',
  }),
});

// First-admin credentials, used only by scripts/seed-admin.js. Kept out of the
// schema above on purpose: the running server never needs the admin password,
// so these keys are optional for it and can be left out of the server's env
// (least privilege). Read on demand and returned raw; the seed script checks
// them with the same Zod rules as register and names the missing keys.
export const getSeedAdminConfig = () => ({
  name: process.env.SEED_ADMIN_NAME,
  email: process.env.SEED_ADMIN_EMAIL,
  phone: process.env.SEED_ADMIN_PHONE,
  password: process.env.SEED_ADMIN_PASSWORD,
});
