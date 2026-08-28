import { adminAuth } from "@/lib/firebase/admin";

export interface AuthedUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  /** True once the address is proven: Google accounts arrive this way, password
   * accounts get here by entering the emailed code. */
  emailVerified: boolean;
}

/** Thrown when a request has no valid Firebase ID token. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when the token is valid but the address was never confirmed.
 *
 * It extends UnauthorizedError on purpose: every route already maps that to a
 * 401, so an unverified signup is locked out of all 17 authenticated routes
 * without touching any of them. The user-facing path never relies on this -
 * the UI gates first (components/VerifyEmailGate.tsx) - this is the backstop
 * for anyone calling the API directly.
 */
export class EmailNotVerifiedError extends UnauthorizedError {
  constructor(message = "Email not verified") {
    super(message);
    this.name = "EmailNotVerifiedError";
  }
}

async function decode(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) throw new UnauthorizedError("Missing bearer token");

  try {
    return await adminAuth().verifyIdToken(match[1]);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

function toUser(decoded: Awaited<ReturnType<typeof decode>>): AuthedUser {
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: (decoded.name as string | undefined) ?? null,
    picture: (decoded.picture as string | undefined) ?? null,
    emailVerified: decoded.email_verified === true,
  };
}

/**
 * Verify the `Authorization: Bearer <idToken>` header on an incoming request.
 * Both the web app and the Chrome extension authenticate this exact way.
 * Throws {@link UnauthorizedError} on any failure - route handlers catch it and
 * return 401 - and {@link EmailNotVerifiedError} if the address is unconfirmed.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser> {
  const user = toUser(await decode(req));
  if (!user.emailVerified) {
    throw new EmailNotVerifiedError();
  }
  return user;
}

/**
 * Same check, minus the verified requirement. ONLY for the two endpoints that
 * run before verification can possibly have happened: sending a code and
 * submitting one. Everything else must use {@link getAuthedUser}.
 */
export async function getAuthedUserAllowUnverified(
  req: Request,
): Promise<AuthedUser> {
  return toUser(await decode(req));
}
