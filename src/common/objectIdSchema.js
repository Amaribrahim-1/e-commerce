import { z } from 'zod';

// A MongoDB ObjectId is exactly 24 hex characters. We check the shape here with
// a regex instead of Mongoose's isValidObjectId, which also accepts any
// 12-character string and would let some invalid ids through.
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

// Ready-made params schema for routes shaped like /something/:id.
export const idParamsSchema = z.object({ id: objectIdSchema });
