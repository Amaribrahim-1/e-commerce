import bcrypt from 'bcrypt';
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

export { hashPassword, verifyPassword };
