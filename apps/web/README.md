# @graft/web

The public marketing site + auth pages. Next.js 16 (App Router, React 19) + Tailwind v4
+ shadcn (Base UI). Serves the landing page at `/` and owns the auth flow (login,
signup, verify, forgot/reset) that feeds into the dashboard.

## Responsibilities

- **Landing page** at `/` — editorial marketing surface composed from modular sections
  (Nav, Hero, ConversationShowcase, FeatureGrid, HowItWorks, IdeaSection, ClosingCta,
  Footer) with a WebGL animated background and motion gated behind
  `prefers-reduced-motion`.
- **Auth pages** under `(auth)` — login / signup / verify / forgot / reset, built on
  Better Auth. After sign-in the user is redirected to the **dashboard** app, which reads
  the shared session cookie. (The dashboard has no auth pages of its own.)
- **Theme:** red glassmorphism with light/dark via `next-themes`.

## Layout

```
src/
  app/
    page.tsx        landing
    (auth)/         login, signup, verify, forgot, reset
  components/
    landing/        marketing sections
    auth/           auth forms
    site/           Reveal, Button, Logo, icons
    ui/             shadcn primitives, animated background
  lib/auth/         Better Auth client
```

## Environment

Gateway base URL for `/api/auth/*` and the dashboard URL for the post-login redirect.
Auth cookie scoping in prod is controlled at the gateway (`AUTH_COOKIE_DOMAIN`).

## Scripts

`pnpm --filter @graft/web dev` (port **3000**) `| build | start | check-types | lint`

## Notes

- Fonts (Geist / Fraunces / Geist Mono) load via Google `<link>` — the `next/font` fetch
  was removed because it hung the offline build, so the build stays network-free.
- The animated background uses the default `unicornstudio-react` export (not `/next`)
  with a pinned `sdkUrl`; it's deferred + faded in so its shader compile doesn't block
  the hero/nav entrance.
