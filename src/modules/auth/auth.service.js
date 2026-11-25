// Business rules of authentication. Knows nothing about HTTP: no req, no res,
// no status codes chosen here except through AppError. The controller turns
// HTTP into plain arguments, calls these functions, and turns the result back
// into a response. Scripts (for example the admin seed) can call them too.
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { User } from '../users/user.model.js';
import { hashPassword } from '../users/password.service.js';

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
