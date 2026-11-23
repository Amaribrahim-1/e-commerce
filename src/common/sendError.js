import { config } from '../config/index.js';

// Sends the one error shape of the API: { status, message, stack? }.
// Operational errors (AppError) expose their own status and message.
// Anything else is a bug: log it and answer with a generic 500, never its details.
export const sendError = (res, err) => {
  const isDevelopment = config.env === 'development';
  let statusCode = 500;
  let response = { status: 'error', message: 'Something went wrong' };

  if (err.isOperational) {
    statusCode = err.statusCode;
    response = { status: err.status, message: err.message };
  } else {
    console.error('ERROR', err);
  }

  // The stack is for the developer's eyes only, never outside development.
  if (isDevelopment) response.stack = err.stack;

  res.status(statusCode).json(response);
};
