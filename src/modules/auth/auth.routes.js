import { Router } from 'express';
import { registerController } from './auth.controller.js';
import { validation } from '../../common/middlewares/validation.js';
import { registerSchema } from './auth.validation.js';

export const authRouter = Router();

authRouter
  .route('/register')
  .post(validation({ body: registerSchema }), registerController);
