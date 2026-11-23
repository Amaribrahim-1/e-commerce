import { AppError } from './AppError.js';

// The request parts a route may validate. Each one is optional.
const PARTS = ['body', 'params', 'query'];

// Builds a middleware from an object of Zod schemas, for example
// { body: someSchema, params: otherSchema }. Parts without a schema are skipped.
export const validation = (schemas) => {
  return (req, res, next) => {
    const validated = {};
    const details = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      // Express 5 leaves req.body undefined when no body was parsed. Treat it
      // as an empty object so the client gets "field is required" errors
      // instead of a confusing "expected object" error.
      const input = part === 'body' ? (req.body ?? {}) : req[part];

      const result = schema.safeParse(input);

      if (result.success) {
        validated[part] = result.data;
      } else {
        // Collect the issues of every part; do not stop at the first failure.
        for (const issue of result.error.issues) {
          details.push({
            location: part,
            path: issue.path.join('.') || part,
            message: issue.message,
          });
        }
      }
    }

    if (details.length > 0) {
      return next(new AppError('Invalid request data.', 400, details));
    }

    // req.query is a read-only getter in Express 5, so parsed values live on
    // their own property instead of replacing the originals.
    req.validated = validated;
    next();
  };
};
