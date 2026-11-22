import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config/index.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let httpServer;
let isShuttingDown = false;

// Log only name and message: the full error object of a failed connection can
// carry the connection string (and the password inside it).
const describeError = (err) =>
  `${err?.name ?? 'Error'}: ${err?.message ?? err}`;

mongoose.connection.on('disconnected', () =>
  console.warn('MongoDB disconnected'),
);
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
mongoose.connection.on('error', (err) =>
  console.error(`MongoDB connection error: ${describeError(err)}`),
);

async function shutdown(reason, exitCode) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${reason}: shutting down`);

  // Safety net: if something hangs (for example a keep-alive connection),
  // do not wait forever. unref() so this timer alone never keeps the process alive.
  setTimeout(() => {
    console.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    if (httpServer?.listening) {
      // Stop accepting new connections and wait for in-flight requests
      // (since Node 19, close() also closes idle keep-alive connections).
      await new Promise((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      );
    }
    await mongoose.disconnect();
    console.log('Shutdown complete');
    process.exit(exitCode);
  } catch (err) {
    console.error(`Error during shutdown: ${describeError(err)}`);
    process.exit(1);
  }
}

async function start() {
  try {
    await mongoose.connect(config.db.uri);
  } catch (err) {
    console.error(`Could not connect to MongoDB: ${describeError(err)}`);
    process.exit(1);
  }
  console.log('MongoDB connected');

  httpServer = app.listen(config.port, 'localhost', () => {
    console.log(`Server listening on port ${config.port} (${config.env})`);
  });
  // Without this, a port already in use would be an uncaught 'error' event.
  httpServer.on('error', (err) => {
    console.error(`HTTP server error: ${describeError(err)}`);
    shutdown('Server error', 1);
  });
}

process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

// After an uncaught exception the process state is unknown, so we do not
// carry on: log it, close what we can, and exit non-zero.
process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled rejection: ${describeError(reason)}`);
  shutdown('Unhandled rejection', 1);
});
process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception: ${describeError(err)}`);
  shutdown('Uncaught exception', 1);
});

start();
