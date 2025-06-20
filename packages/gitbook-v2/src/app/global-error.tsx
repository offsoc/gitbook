'use client';

import NextError from 'next/error';
import { getLogger } from './utils';

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    getLogger().error('Global error:', error);
    return (
        <html lang="en">
            <body>
                <NextError statusCode={undefined as any} />
            </body>
        </html>
    );
}
