// Authentication ("who is sending this request?") and authorization ("may this
// user do this?"), as two separate middlewares used in that order.
//
// Lives in the auth module, not in common/middlewares, because it depends on
// the User model and on how tokens are signed (docs/02-decisions.md).
import jwt from 'jsonwebtoken';
import { AppError } from '../../common/errors/AppError.js';
import { config } from '../../config/index.js';
import { User } from '../users/user.model.js';
import { ROLES } from '../../common/constants/roles.js';

const BEARER_PREFIX = 'Bearer ';

// True when the token was issued before the last password change, so it must
// stop working: changing the password is how a user signs out every device.
// A JWT cannot be revoked one by one, so this time is the cut-off line.
//
// Units: `iat` is whole seconds (jsonwebtoken floors it); getTime() is
// milliseconds. Math.floor brings both to whole seconds. `<`, not `<=`: a new
// token made in the same second as the change (P2-T06 returns one) must pass.
// The cost is that an old token from that same second also passes; a window
// under one second is accepted.
const isIssuedBeforePasswordChange = (iat, passwordChangedAt) => {
  if (!passwordChangedAt) return false;
  const changedAtSeconds = Math.floor(passwordChangedAt.getTime() / 1000);
  return iat < changedAtSeconds;
};

// Checks the access token on a protected route and puts the current user on
// req.currentUser. Checks go from cheapest to most expensive: the header, then
// the signature (CPU only), then the database.
//
// Every failure is 401: the client is not authenticated and should log in
// again. No try/catch: jwt.verify throws, Express 5 forwards the rejected
// promise to the global error handler, and that handler turns JWT errors
// into 401.
export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) {
    throw new AppError(
      'You are not logged in. Please log in to get access.',
      401,
    );
  }
  // An empty token ("Bearer ") is rejected by jwt.verify ("jwt must be
  // provided"), so it needs no check of its own.
  const token = header.slice(BEARER_PREFIX.length);

  // `algorithms` is an allow-list. Without it, verify accepts HS256, HS384 and
  // HS512, and the algorithm is read from the token header, which the client
  // writes. It is the same constant signAccessToken uses.
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: [config.jwt.algorithm],
  });

  // The user is read from the database on every request, so a deactivation,
  // a password change or a new role (P2-T04) takes effect at once, without
  // waiting for the token to expire. passwordHash stays unselected.
  const user = await User.findById(payload.sub);

  // Deleted and deactivated users get the same answer: this token no longer
  // stands for a valid session. (Login answers a deactivated account with
  // 403; see docs/02-decisions.md, "Login (P2-T03)".)
  if (!user || !user.isActive) {
    throw new AppError(
      'This account is no longer available. Please log in again.',
      401,
    );
  }

  if (isIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt)) {
    throw new AppError(
      'The password was changed recently. Please log in again.',
      401,
    );
  }

  // From here on, the user id comes only from req.currentUser (the verified
  // token), never from the body, params or query.
  req.currentUser = user;
  next();
};

const VALID_ROLES = Object.values(ROLES);

// Authorization: "may this user do this?". Usage on a route:
//   router.get('/x', authenticate, authorize(ROLES.ADMIN), handler)
// It must run after authenticate and reads the role from req.currentUser,
// which comes from the database, not from the token (the token has no role).
//
// The outer function runs once, when the routes are defined (at startup), so
// a wrong call such as authorize() or authorize(ROLES.ADMNI) crashes the app
// on start instead of silently locking the route (fail fast).
//
// Programmer mistakes throw a plain Error, not AppError: sendError treats it
// as a bug, logs it, and the client gets a generic 500 without the details.
export const authorize = (...allowedRoles) => {
  if (allowedRoles.length === 0) {
    throw new Error('authorize() needs at least one role');
  }
  for (const role of allowedRoles) {
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`authorize(): unknown role "${role}"`);
    }
  }

  return (req, res, next) => {
    if (!req.currentUser) {
      throw new Error('authorize() must run after authenticate');
    }
    if (!allowedRoles.includes(req.currentUser.role)) {
      throw new AppError(
        'You do not have permission to perform this action.',
        403,
      );
    }
    next();
  };
};
