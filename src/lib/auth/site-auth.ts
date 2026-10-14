/**
 * Whether WhoFundsOSS has visitor sign-in. It does not: the site is a public,
 * read-only record (no accounts, AGENTS.md §0.5), so there is no
 * `src/routes/api/auth/$.ts` and `/api/auth/*` does not exist.
 *
 * The template decides auth from `VITE_AUTH_ENABLED`, but its "false" lives in
 * the sandbox-only `.grok/app-env.json` (gitignored). On Vercel the variable is
 * unset, which the template reads as "auth on", so every page called
 * `/api/auth/get-session` and got a 404. This constant is the committed source
 * of truth; `site-auth.test.ts` fails if it disagrees with the routes.
 */
export const SITE_HAS_SIGN_IN = false;

/** Client auth switch: needs the site to have sign-in AND the env not to turn it off. */
export function resolveAuthEnabled(siteHasSignIn: boolean, envValue: string | undefined): boolean {
  return siteHasSignIn && envValue !== "false";
}
