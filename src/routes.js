import { Router } from 'express';
import { sendSuccess } from './common/http/sendSuccess.js';

// The root router, mounted under /api/v1 in app.js. It only decides the prefix
// of each module; every module owns its endpoints in <entity>.routes.js and is
// mounted here (the first one comes in P2-T02).
export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendSuccess(res, 200, null);
});
