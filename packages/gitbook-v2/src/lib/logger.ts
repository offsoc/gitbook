import { createLogger } from '@/lib/logger';
import { cache } from 'react';

export const getLogger = cache(() => {
    // This is not cryptographically secure, but it's fine for logging purposes.
    // It allows us to identify logs from the same request.
    // If we are in the middleware, we don't set a request ID because cache won't work well there.
    const requestId =
        process.env.NEXT_RUNTIME === 'edge'
            ? undefined
            : Math.random().toString(36).substring(2, 15);
    return createLogger('GBOV2', requestId);
});
