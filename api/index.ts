import { createApiApp, attachErrorHandler } from '../src/index';

export const config = {
  maxDuration: 60,
};

const app = createApiApp();
attachErrorHandler(app);

export default app;
