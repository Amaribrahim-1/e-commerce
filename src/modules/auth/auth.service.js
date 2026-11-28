// Business rules of authentication. Knows nothing about HTTP: no req, no res,
// no status codes chosen here except through AppError. The controller turns
// HTTP into plain arguments, calls these functions, and turns the result back
// into a response. Scripts (for example the admin seed) can call them too.
import jwt from 'jsonwebtoken';
import { ROLES } from '../../common/constants/roles.js';
import { AppError } from '../../common/errors/AppError.js';
import { config } from '../../config/index.js';
import {
  hashPassword,
  simulatePasswordCheck,
  verifyPassword,
} from '../users/password.service.js';
import { User } from '../users/user.model.js';

// One constant for both failure paths of login, so the two messages cannot
// drift apart by accident (a different message would reveal which one failed).
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

// Signs an access token for a user. The payload holds only the user id, in the
// standard "sub" (subject) claim. "iat" (issued at) is added by jsonwebtoken
// and "exp" comes from expiresIn.
// Not in the payload on purpose:
// - the role: it can change (P2-T05), and a token keeps the old value until it
//   expires. The auth middleware (P2-T03) loads the user from the database on
//   every request anyway, so the current role is always read from there.
// - anything private: a JWT is signed, not encrypted; anyone can read it.
export const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId) }, config.jwt.secret, {
    algorithm: config.jwt.algorithm,
    expiresIn: config.jwt.expiresIn,
  });

// Creates a customer account and returns the new user with an access token.
// `input` is the validated body: unknown keys (such as "role") were already
// stripped by Zod, and passwordConfirmation was only needed for validation.
export const register = async ({ name, email, phone, password }) => {
  const passwordHash = await hashPassword(password);

  // The role is set here, explicitly, instead of relying on the schema default.
  // The rule "register always creates a customer" belongs to this function; if
  // the schema default ever changes, public sign-up must not change with it.
  //
  // No "does this email exist?" query first: two requests at the same moment
  // could both pass that check. The unique index is the real guard; its
  // duplicate key error (11000) becomes 409 in the global error handler.
  const user = await User.create({
    name,
    email,
    phone,
    passwordHash,
    role: ROLES.CUSTOMER,
  });

  const token = signAccessToken(user.id);

  // The document's toJSON removes passwordHash and __v when it is sent, so the
  // caller can return it as it is.
  return { user, token };
};

// Checks an email and password and returns the user with a new access token.
// `email` is already trimmed and lowercased by Zod, like on register, so it
// matches the stored value.
//
// Unknown email and wrong password look exactly the same from outside: same
// status (401), same message, and about the same response time. Otherwise the
// login endpoint would tell anyone which emails have an account
// (user enumeration).
export const login = async ({ email, password }) => {
  // passwordHash has select: false in the schema, so it is asked for here, the
  // only place that needs it. It never reaches the client: the document's
  // toJSON removes it.
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    // No hash to compare with, but the slow bcrypt work still runs, so this
    // path is not measurably faster than the wrong-password path below.
    await simulatePasswordCheck(password);
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  // Checked only after the password is proven correct, so only the account
  // owner can learn that the account is deactivated; someone guessing emails
  // learns nothing new. 403, not 401: the credentials are valid, and the server
  // refuses this account (see docs/02-decisions.md, "Login (P2-T03)").
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated', 403);
  }

  const token = signAccessToken(user.id);

  return { user, token };
};
