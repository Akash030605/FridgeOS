import { createApiApp, attachErrorHandler } from './apiApp';

export const config = {
  maxDuration: 60,
};

const app = createApiApp();
attachErrorHandler(app);

export default app;
