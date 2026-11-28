import { Router } from 'express';
import { validation } from '../../common/middlewares/validation.js';
import { loginController, registerController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.validation.js';

export const authRouter = Router();

authRouter
  .route('/register')
  .post(validation({ body: registerSchema }), registerController);

authRouter
  .route('/login')
  .post(validation({ body: loginSchema }), loginController);
