import { adminAuth } from "@/lib/firebase/admin";

export interface AuthedUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** Thrown when a request has no valid Firebase ID token. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Verify the `Authorization: Bearer <idToken>` header on an incoming request.
 * Both the web app and the Chrome extension authenticate this exact way.
 * Throws {@link UnauthorizedError} on any failure - route handlers catch it and
 * return 401.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) throw new UnauthorizedError("Missing bearer token");

  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
