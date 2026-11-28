import { Router } from 'express';
import { sendSuccess } from './common/http/sendSuccess.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';

// The root router, mounted under /api/v1 in app.js. It only decides the prefix
// of each module; every module owns its endpoints in <entity>.routes.js and is
// mounted here with its prefix only (app.js adds /api/v1, the module adds the
// rest of the path).
export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendSuccess(res, 200, null);
});

apiRouter.use('/auth', authRouter);

apiRouter.use('/users', userRouter);
