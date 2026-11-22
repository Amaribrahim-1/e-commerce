import { app } from './app.js';
import { config } from './config/index.js';

app.listen(config.port, 'localhost', () => {
  console.log(`Server listening on port ${config.port} (${config.env})`);
});
