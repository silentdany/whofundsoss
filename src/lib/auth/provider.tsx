import { useEffect, useRef, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import { useCurrentUserState } from "./use-current-user";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone. This provider synchronizes the resolved
 * session with PostHog once, so client events and exception capture inherit the
 * stable Better Auth user ID for the rest of the session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const posthog = usePostHog();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isPending || !posthog) return;

    if (!user) {
      if (identifiedUserId.current) {
        posthog.reset();
        identifiedUserId.current = null;
      }
      return;
    }

    if (identifiedUserId.current === user.id) return;

    if (identifiedUserId.current) posthog.reset();

    posthog.identify(user.id, {
      email: user.primaryEmail ?? undefined,
      name: user.displayName ?? undefined,
    });
    identifiedUserId.current = user.id;
  }, [isPending, posthog, user]);

  return <>{children}</>;
}
