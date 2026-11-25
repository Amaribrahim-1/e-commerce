// Limits of User fields, shared by the User schema (last line of defence for
// writes that skip Zod, such as scripts and seeds) and the Zod schemas at the
// edge, so the two can never drift apart. Other modules import them from here;
// the users module owns the rules of its own entity.
export const NAME_MIN = 2;
export const NAME_MAX = 50;
