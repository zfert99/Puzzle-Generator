export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/logger');
    logger.info({ event: 'app_start', runtime: process.env.NEXT_RUNTIME }, 'Application initialized');

    // Catch global unhandled rejections to prevent silent failures
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error({ event: 'unhandled_rejection', reason, promise }, 'Unhandled Rejection at Promise');
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error({ event: 'uncaught_exception', error }, 'Uncaught Exception thrown');
      // In a real prod environment, you'd likely want to process.exit(1) here
      // depending on whether the process can recover.
    });
  }
}

/**
 * Next.js server-side error hook. Fires for every error thrown during a request
 * (App Router, Pages Router, Route Handlers, and Server Actions). We emit a
 * single structured "wide event" per error rather than scattering logs — see
 * AGENTS.md Section 5. Guarded to the Node.js runtime because Pino's transport
 * relies on worker threads that are unavailable on the Edge runtime.
 */
export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?: string;
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { logger } = await import('./lib/logger');
  const err = error as Error;
  logger.error(
    {
      event: 'request_error',
      error: err?.message,
      stack: err?.stack,
      method: request.method,
      path: request.path,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    'Server error during request'
  );
}
