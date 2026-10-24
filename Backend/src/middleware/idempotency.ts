import type { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  state: 'processing' | 'completed';
  statusCode?: number;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  createdAt: number;
}

// In-memory cache for idempotency responses (TTL: 24 hours)
const IDEMPOTENCY_CACHE = new Map<string, CachedResponse>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of IDEMPOTENCY_CACHE.entries()) {
    if (now - value.createdAt > TTL_MS) {
      IDEMPOTENCY_CACHE.delete(key);
    }
  }
}, 30 * 60 * 1000).unref();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Idempotency applies to state-mutating HTTP methods
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    next();
    return;
  }

  // Extract idempotency key from header, body, or query
  const rawKey =
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    req.body?.idempotencyKey ||
    req.query?.idempotencyKey;

  if (!rawKey) {
    next();
    return;
  }

  const key = Array.isArray(rawKey) ? rawKey[0] : String(rawKey).trim();
  if (!key) {
    next();
    return;
  }

  // Namespace key by path and merchant if present to avoid cross-tenant collision
  const userIdentifier = (req as any).user?.identifier || (req as any).user?.tin || 'anon';
  const compositeKey = `${req.baseUrl || ''}${req.path}:${userIdentifier}:${key}`;

  const cached = IDEMPOTENCY_CACHE.get(compositeKey);

  if (cached) {
    if (cached.state === 'processing') {
      res.status(409).json({
        success: false,
        error: 'A request with this Idempotency-Key is currently in progress. Please retry shortly.',
        idempotencyKey: key,
      });
      return;
    }

    if (cached.state === 'completed' && cached.statusCode !== undefined) {
      // Replay exact cached response
      res.setHeader('Idempotency-Key', key);
      res.setHeader('Idempotency-Replayed', 'true');
      res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');

      if (cached.headers) {
        for (const [hKey, hVal] of Object.entries(cached.headers)) {
          if (hVal && !['content-length', 'transfer-encoding', 'connection'].includes(hKey.toLowerCase())) {
            res.setHeader(hKey, hVal);
          }
        }
      }

      res.status(cached.statusCode).send(cached.body);
      return;
    }
  }

  // Mark as processing
  IDEMPOTENCY_CACHE.set(compositeKey, {
    state: 'processing',
    createdAt: Date.now(),
  });

  res.setHeader('Idempotency-Key', key);

  // Intercept response to store result upon completion
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  let responseBody: any = null;

  res.send = function (body?: any): Response {
    responseBody = body;
    return originalSend(body);
  };

  res.json = function (body?: any): Response {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Only cache successful or client-validation responses; if server crashed (5xx), allow client to retry fresh
    if (res.statusCode < 500) {
      let finalBody = responseBody;
      // If body was an object or buffer, ensure it's serializable
      if (typeof responseBody === 'string') {
        try {
          finalBody = JSON.parse(responseBody);
        } catch {
          finalBody = responseBody;
        }
      }

      IDEMPOTENCY_CACHE.set(compositeKey, {
        state: 'completed',
        statusCode: res.statusCode,
        body: finalBody,
        headers: {
          'content-type': res.getHeader('content-type') as string,
        },
        createdAt: Date.now(),
      });
    } else {
      // Evict on 5xx so subsequent retries are processed
      IDEMPOTENCY_CACHE.delete(compositeKey);
    }
  });

  next();
}

export default idempotencyMiddleware;
