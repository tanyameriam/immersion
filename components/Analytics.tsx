"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { identifyUser, initAnalytics, trackPageview } from "@/lib/analytics";

/** useSearchParams() forces a Suspense boundary, so pageview tracking lives in
 * its own child component. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams.toString();
    trackPageview(window.location.origin + pathname + (query ? `?${query}` : ""));
  }, [pathname, searchParams]);

  return null;
}

/**
 * Site-wide analytics (PostHog): pageviews on every route change, plus
 * identifying events by the signed-in account. Renders nothing, sends nothing
 * unless NEXT_PUBLIC_POSTHOG_KEY is set.
 */
export function Analytics() {
  const { user } = useAuth();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (user) identifyUser(user.uid, { email: user.email, name: user.name });
  }, [user]);

  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
