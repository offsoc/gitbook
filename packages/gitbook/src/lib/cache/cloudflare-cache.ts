import { Buffer } from 'node:buffer';

import type { Cache, CacheStorage, Response as WorkerResponse } from '@cloudflare/workers-types';

import { trace } from '../tracing';
import type { CacheBackend, CacheEntry } from './types';
import {
    NON_IMMUTABLE_LOCAL_CACHE_MAX_AGE_SECONDS,
    getCacheMaxAge,
    isCacheEntryImmutable,
} from './utils';

const cacheVersion = 2;

/**
 * Cache implementation using the Cloudflare Cache API.
 * https://developers.cloudflare.com/workers/runtime-apis/cache/
 */
export const cloudflareCache: CacheBackend = {
    name: 'cloudflare',
    replication: 'local',
    async get(entry, options) {
        const cache = getCache();
        if (!cache) {
            return null;
        }
        return trace(
            {
                operation: 'cloudflareCache.get',
                name: entry.key,
            },
            async (span) => {
                const cacheKey = await serializeKey(entry.key);
                const response = await cache.match(cacheKey);
                span.setAttribute('hit', !!response);

                options?.signal?.throwIfAborted();
                if (!response) {
                    return null;
                }

                const cacheEntry = await deserializeEntry(response);
                return cacheEntry;
            }
        );
    },
    async set(entry) {
        const cache = getCache();
        if (cache) {
            await trace(
                {
                    operation: 'cloudflareCache.set',
                    name: entry.meta.key,
                },
                async () => {
                    const cacheKey = await serializeKey(entry.meta.key);
                    await cache.put(cacheKey, serializeEntry(entry));
                }
            );
        }
    },
    async del(entries) {
        const cache = getCache();
        if (cache) {
            await Promise.all(
                entries.map(async (entry) => {
                    const cacheKey = await serializeKey(entry.key);
                    await cache.delete(cacheKey);
                })
            );
        }
    },
    async revalidateTags(_tags) {
        return {
            entries: [],
        };
    },
};

function getCache(): Cache | null {
    if (typeof caches === 'undefined') {
        return null;
    }

    // @ts-ignore
    return (caches as CacheStorage).default ?? null;
}

async function serializeKey(key: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        {
            name: 'SHA-256',
        },
        new TextEncoder().encode(key)
    );

    const hash = Buffer.from(digest).toString('base64');

    return `gitbook://${cacheVersion}.gitbook.com/${hash}`;
}

function serializeEntry(entry: CacheEntry): WorkerResponse {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const cacheTags = ['gitbook-open'];
    if (entry.meta.tag) {
        cacheTags.push(entry.meta.tag);
    }

    const maxAge = getCacheMaxAge(
        entry.meta,
        10,
        // When the entry is immutable, we can cache it for the entire duration.
        // Else we cache it for a very short time.
        isCacheEntryImmutable(entry.meta) ? undefined : NON_IMMUTABLE_LOCAL_CACHE_MAX_AGE_SECONDS
    );
    headers.set('Cache-Control', `public, max-age=${maxAge}`);
    headers.set('Cache-Tag', cacheTags.join(','));

    // @ts-ignore
    return new Response(JSON.stringify(entry), {
        headers,
        cf: {
            cacheTags,
        },
    });
}

async function deserializeEntry(response: WorkerResponse): Promise<CacheEntry> {
    const entry = (await response.json()) as CacheEntry;
    return entry;
}
