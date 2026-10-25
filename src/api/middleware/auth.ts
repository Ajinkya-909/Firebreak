import { getAuth } from '@clerk/express';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Dashboard routes: require a signed-in Clerk user. Returns 401 JSON instead of redirecting. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function currentUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error('currentUserId called on an unauthenticated request');
  return userId;
}

/** Machine-to-machine webhooks authenticate with `Authorization: Bearer <shared secret>`. */
export function requireSharedSecret(secret: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const provided = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const ok =
      !!secret && provided.length === secret.length && timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
    if (!ok) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };
}
