import express from 'express';
import { sendSuccess } from './common/sendSuccess.js';
import { notFoundHandler } from './common/notFoundHandler.js';
import { globalErrorHandler } from './common/globalErrorHandler.js';

export const app = express();
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  sendSuccess(res, 200, null);
});

app.use(notFoundHandler);
app.use(globalErrorHandler);
