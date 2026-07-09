export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/logger');
    logger.info({ event: 'app_start', runtime: process.env.NEXT_RUNTIME }, 'Application initialized');
    
    // Catch global unhandled rejections to prevent silent failures
    process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
      logger.error({ event: 'unhandled_rejection', reason, promise }, 'Unhandled Rejection at Promise');
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error({ event: 'uncaught_exception', error }, 'Uncaught Exception thrown');
      // In a real prod environment, you'd likely want to process.exit(1) here 
      // depending on whether the process can recover.
    });
  }
}
