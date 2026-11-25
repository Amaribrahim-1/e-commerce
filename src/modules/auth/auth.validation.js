import { z } from 'zod';
import { EGYPT_PHONE_REGEX } from '../../common/validators/phone.js';
import { NAME_MAX, NAME_MIN } from '../users/user.constants.js';

// Limits in one place, so a policy change is a one-line edit. The name limits
// come from the users module because the User schema enforces them too.
// Practical maximum length of an email address (RFC 5321 path limit).
const EMAIL_MAX = 254;
// NIST SP 800-63B and OWASP: at least 8 characters, allow at least 64,
// and no composition rules (no "must contain a digit and a symbol").
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;
// bcrypt hashes only the first 72 bytes and silently ignores the rest.
// Counted in bytes, not characters: an Arabic letter is 2 bytes in UTF-8.
const BCRYPT_MAX_BYTES = 72;

// A string field with a clear message when it is missing or not a string,
// instead of Zod's default "Invalid input: expected string, received undefined".
const requiredString = (label) =>
  z.string({
    error: (issue) =>
      issue.input === undefined
        ? `${label} is required`
        : `${label} must be a string`,
  });

const nameSchema = requiredString('Name')
  .trim()
  .min(NAME_MIN, { error: `Name must be at least ${NAME_MIN} characters long` })
  .max(NAME_MAX, { error: `Name must be at most ${NAME_MAX} characters long` });

// Normalize first (trim, lowercase), then check the format. z.email() checks
// its format before any method chained after it, so the cleaned string is
// piped into it instead.
const emailSchema = requiredString('Email')
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, { error: 'Email is too long' })
  .pipe(z.email({ error: 'Invalid email address' }));

const phoneSchema = requiredString('Phone').trim().regex(EGYPT_PHONE_REGEX, {
  error: 'Phone must be an Egyptian mobile number like 01012345678',
});

// Not trimmed: spaces are valid password characters, and changing what the
// user typed would make the same password fail at login.
const passwordSchema = requiredString('Password')
  .min(PASSWORD_MIN, {
    error: `Password must be at least ${PASSWORD_MIN} characters long`,
  })
  .max(PASSWORD_MAX, {
    error: `Password must be at most ${PASSWORD_MAX} characters long`,
  })
  .refine((value) => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES, {
    error: 'Password is too long',
  });

// Unknown keys (for example "role") are stripped by z.object, so the handler
// never sees them. The service still sets the role itself.
export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    passwordConfirmation: requiredString('Password confirmation'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    error: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });
