export class AppError extends Error {
  // `details` is optional: a list of field-level errors, used by validation.
  constructor(message, statusCode, details) {
    super(message);
    if (details) this.details = details;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
