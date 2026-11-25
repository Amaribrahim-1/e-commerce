import { AppError } from './AppError.js';
import { sendError } from '../http/sendError.js';

const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateKeyError = (err) => {
  // keyValue holds the duplicated field(s); guard in case the driver omits it.
  const field = Object.keys(err.keyValue ?? {})[0];
  const message = field
    ? `A record with this ${field} already exists.`
    : 'A record with this value already exists.';
  return new AppError(message, 409);
};

const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input data. ${messages.join(', ')}`, 400);
};

const handleMalformedJson = () =>
  new AppError('Request body is not valid JSON.', 400);

const handleBodyTooLarge = () =>
  new AppError('Request body is too large.', 413);

// Turns known library errors into operational ones. Anything unknown is
// returned untouched and ends up as a generic 500 in sendError.
const translateError = (err) => {
  if (err.code === 11000) return handleDuplicateKeyError(err);
  if (err.name === 'CastError') return handleCastError(err);
  if (err.name === 'ValidationError') return handleValidationError(err);
  // express.json() (body-parser) raises this for a body that is not valid JSON.
  if (err.type === 'entity.parse.failed') return handleMalformedJson();
  // express.json() raises this when the body is bigger than the configured limit.
  if (err.type === 'entity.too.large') return handleBodyTooLarge();
  return err;
};

// Express recognises an error handler by its 4 parameters, so `next` must stay
// even though it is only used for the headersSent case.
export const globalErrorHandler = (err, req, res, next) => {
  // If the response has already started we cannot send a new one; hand the
  // error to Express's default handler, which closes the connection.
  if (res.headersSent) return next(err);

  // Anything can be thrown (even a string); work with a real Error object.
  const error = err instanceof Error ? err : new Error(String(err));

  sendError(res, translateError(error));
};
