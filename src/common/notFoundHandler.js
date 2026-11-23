import { AppError } from './AppError.js';

export const notFoundHandler = (req, res, next) => {
  next(
    new AppError(
      `Cannot find that route ${req.originalUrl} on this server`,
      404,
    ),
  );
};
