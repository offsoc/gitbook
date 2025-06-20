'use client';

import NextError from 'next/error';

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    // We cannot use the logger here because this is a client component.
    console.error('[GBOV2:GlobalError]', error);
    return (
        <html lang="en">
            <body>
                <NextError statusCode={undefined as any} />
            </body>
        </html>
    );
}
