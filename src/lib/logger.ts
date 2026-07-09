import pino from 'pino';

// Initialize the Pino logger.
// In production, it will output raw fast JSON to stdout.
// In development, if pino-pretty is installed, it will pipe to it for human readability.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    },
  }),
});
