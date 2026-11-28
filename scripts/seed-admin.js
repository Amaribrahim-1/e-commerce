// Creates the first admin from the SEED_ADMIN_* env keys. Run: npm run seed:admin
// Register always creates a customer, so the first admin cannot come from the
// API (docs/02-decisions.md, "Staff and roles"). Later staff accounts are
// created by an admin through the API (P2-T05).
//
// Idempotent: when any admin already exists it changes nothing and exits with
// 0, so running it again (by hand or in a deploy step) is always safe.
// Exit codes: 0 = created or already there, 1 = anything went wrong.
import mongoose from 'mongoose';
import { z } from 'zod';
import { ROLES } from '../src/common/constants/roles.js';
import { config, getSeedAdminConfig } from '../src/config/index.js';
import {
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
} from '../src/modules/auth/auth.validation.js';
import { hashPassword } from '../src/modules/users/password.service.js';
import { User } from '../src/modules/users/user.model.js';

// The same field rules as register, so the admin cannot get a weaker password
// or a phone the User schema would reject.
const adminSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

// Same reason as in server.js: a connection error can carry the URI.
const describeError = (err) =>
  `${err?.name ?? 'Error'}: ${err?.message ?? err}`;

const readAdminInput = () => {
  const parsed = adminSchema.safeParse(getSeedAdminConfig());
  if (!parsed.success) {
    // Name the env key and the rule, never the value (it may be the password).
    const problems = parsed.error.issues
      .map(
        (issue) =>
          `  - SEED_ADMIN_${String(issue.path[0]).toUpperCase()}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid seed admin settings:\n${problems}`);
  }
  return parsed.data;
};

const seedAdmin = async () => {
  // Checked before connecting: a bad .env fails fast, without touching the DB.
  const admin = readAdminInput();

  await mongoose.connect(config.db.uri);
  // Waits until the unique email index exists. On a new database Mongoose
  // builds it in the background, and without this wait two parallel runs
  // could both insert (Mongoose docs, "The unique Option is Not a Validator").
  await User.init();

  // The rule is "the first admin", not "this email": once any admin exists,
  // more admins come from the API, never from this script.
  if (await User.exists({ role: ROLES.ADMIN })) {
    console.log('An admin already exists. Nothing to do.');
    return;
  }

  // Never promote an existing account: whoever registered this email owns
  // its password, so making it admin would hand them the whole store.
  if (await User.exists({ email: admin.email })) {
    throw new Error(
      'SEED_ADMIN_EMAIL already belongs to a non-admin user. Use another email.',
    );
  }

  const passwordHash = await hashPassword(admin.password);

  try {
    await User.create({
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      passwordHash,
      role: ROLES.ADMIN,
    });
  } catch (err) {
    // Both checks above passed, but someone took the email in between (most
    // likely a second run at the same moment). The unique index is what
    // really prevents the duplicate; the checks only give clear messages.
    if (err.code === 11000) {
      throw new Error(
        'The email was taken while seeding (another run?). Run it again to see the current state.',
        { cause: err },
      );
    }
    throw err;
  }

  console.log(`Admin created: ${admin.email}`);
};

// exitCode instead of process.exit(): the finally block still disconnects
// and the logs are flushed before Node exits on its own.
try {
  await seedAdmin();
} catch (err) {
  console.error(`Seeding failed. ${describeError(err)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
