import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { config } from '../../config/index.js';

// The only module that imports bcrypt. Hashing happens here (called from the
// services), not in a pre-save hook: save hooks do not run on findOneAndUpdate
// or updateOne, so a hook could let a plain password through on an update.
// bcrypt reads only the first 72 bytes; longer passwords are rejected by Zod.

// Returns a bcrypt hash; the random salt is generated and stored inside it.
const hashPassword = async (password) => {
  const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);
  return hashedPassword;
};

// Resolves to true when the plain password matches the stored hash.
const verifyPassword = async (password, passwordHash) => {
  const isMatch = await bcrypt.compare(password, passwordHash);
  return isMatch;
};

// Login with an unknown email must take as long as login with a wrong password,
// or the response time alone tells an attacker which emails are registered
// (timing-based user enumeration). So the unknown-email path still runs one
// bcrypt compare, against this dummy hash.
//
// The dummy hash is made by hashPassword, not written by hand, so it always has
// the same cost (BCRYPT_SALT_ROUNDS) as the stored hashes, even after the
// config changes, and it is always a hash bcrypt accepts. It is the hash of
// random bytes, so no password can match it.
//
// Made once, on first use, and then reused: hashing on every request would
// make the unknown-email path twice as slow as the normal one. The promise is
// cached rather than the string, so two first requests at the same moment share
// one hashing job. If hashing ever fails, the cache is cleared so the next
// request tries again instead of failing forever.
let dummyHashPromise;

const getDummyHash = () => {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString('hex')).catch(
    (error) => {
      dummyHashPromise = undefined;
      throw error;
    },
  );
  return dummyHashPromise;
};

// Does the work of verifyPassword without a real hash to check against. The
// result is always "no match", so nothing is returned.
const simulatePasswordCheck = async (password) => {
  await verifyPassword(password, await getDummyHash());
};

export { hashPassword, simulatePasswordCheck, verifyPassword };
