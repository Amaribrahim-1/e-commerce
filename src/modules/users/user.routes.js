import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getMe } from './user.controller.js';

export const userRouter = Router();

// "me" instead of an id in the path: the user always comes from the verified
// token, so one user can never ask for another user's profile here.
userRouter.route('/me').get(authenticate, getMe);
