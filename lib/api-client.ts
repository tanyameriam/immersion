import { auth } from "@/lib/firebase/client";

/**
 * fetch() wrapper that attaches the current user's Firebase ID token as a
 * Bearer header - the same auth scheme the server verifies via getAuthedUser().
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
