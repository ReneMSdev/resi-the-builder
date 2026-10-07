# Work History Review

Findings log for restructuring the work history in `backend/app/data/profile.json` before
live Auto Apply testing (see `docs/todo.md`). Each project section comes from a read-only
background agent that checked the profile's bullets against that project's repo and, where
one exists, its portfolio case study (`~/Dev/portfolio-website/src/data/projects.ts`,
`docs/portfolio-handoff/*/entry.md`).

Nothing here has been applied to `profile.json`. Changes go in only after the user approves
them.

**Verdicts:** CONFIRMED (code or a source backs it), OVERSTATED (true in part, wording or
number goes further than the evidence), CONTRADICTED (evidence says otherwise),
UNVERIFIABLE (can't be checked from the repo; needs the user).

## Started 2026-10-07

| Agent | Repo | Profile entries | Case study |
|---|---|---|---|
| linkleaf | `~/Dev/linkleaf-mono` (+ `~/Dev/_archive/linkleaf`) | Salo Labs LLC (b_salo_1–7) | yes (`linkleaf`) |
| route-planner | `~/Dev/route-planner-nextjs` | Route Planning Web App (b_rp_1–3) | yes (`route-planner`) |
| atx | `~/Dev/atx-reliable-wrenching` | ATX Reliable Wrenching (b_atx_1–4) | yes (`mobile-mechanic`) |
| weather-backend | `~/Dev/weather-alerts-backend` | Weather Alerts API Backend (b_wa_1–3) | no |
| weather-mobile | `~/Dev/WeatherAlertsRN` | React Native Weather App (b_wam_1–4) | no |

**Not covered by any agent** (no local repo, or not a code project): Freelance bullets
b_fl_1–7 (Ecobridge, life-coach site), and the technician roles (SandCastle, Polaris,
Unmuted, DCOMM). These need the user to confirm.

<!-- Agent findings are appended below as each agent reports. -->

---

## ATX Reliable Wrenching
_Repo: ~/Dev/atx-reliable-wrenching @ dev 7b291cd; inspected 2026-10-07_

`main` is at 4fc9617, one commit behind `dev`. `git diff --stat main..dev` shows only README.md (+149/-38) and LICENSE changed; the site code is the same on both branches. The README on `main` is still the create-next-app boilerplate, and the LICENSE on `main` is MIT, which conflicts with the client-ownership license on `dev` (see Needs the user).

### Bullet verdicts
| Bullet | Verdict | Evidence | Suggested fix |
|---|---|---|---|
| b_atx_1 (services, about, embedded Google reviews) | OVERSTATED | All 9 services are in `app/components/sections/services/serviceDetails.ts`: Check Engine Light, Brake Repair, Coolant Leak Repair, Suspension Diagnostics, Electrical Repairs, General Maintenance, Hybrid System Repair, Diesel Repair, Minor Body Work. "Hybrid/diesel" is two separate services. The About section exists (`About.tsx:26`, years computed from 2016 in `YearsOfExperience.ts`). The reviews are **not embedded**: they are 8 review texts copied by hand into `reviewsDetails.ts` (`grep -c author` gives 8), shown in a CSS marquee under the heading "Our Google Reviews" (`Reviews.tsx:13`). There is no widget, iframe, script or Places API (grep found none). A comment in `About.tsx:13` ("background from Figma") suggests a Figma design, but who did the design is unconfirmed. | "...services showcase (9 services, from check-engine diagnostics to hybrid and diesel repair) shown in an Embla carousel, an About section, and a scrolling marquee of customer Google reviews." Drop "embedded". |
| b_atx_2 (HousecallPro plugin, scheduling within the site) | OVERSTATED | `app/components/ui/BookNowBtn.tsx:12,19`: the button calls `window.open(href,'_blank')` to `book.housecallpro.com/...`. That opens an external page in a new tab. It is not a plugin and not embedded, and both the README ("Booking: Housecall Pro (external link)") and the case study ("linking out to Housecall Pro") say so. | "Routed online booking to the client's Housecall Pro scheduling page through Book Now calls to action placed across the page." |
| b_atx_3 (image-optimized, mobile-first, contact form) | OVERSTATED (form part is CONFIRMED and undersold) | `next/image` is used in 8 components (Hero, About, AboutImage, Services, ServiceCard, Reviews, Contact, Nav, MobileNav). The hero uses `fill priority` (`Hero.tsx:11-15`), ServiceCard uses `sizes='100vw'` (`ServiceCard.tsx:31`). There is no `formats`/`quality` config, and `next.config.ts` only whitelists `picsum.photos`. The hero source image `public/images/engine.jpg` is **8,407,739 bytes** (`ls -la`), so the source assets are not optimized; the only optimization is next/image's default resize and format conversion. "Mobile-first" is not provable: there is a separate MobileNav and a desktop/mobile switch at 900px (README; `page.tsx`). The contact form really sends: client-side validation and a phone mask (`ContactForm.tsx`), then a POST to `app/api/contact/route.ts`, which uses Nodemailer over Brevo SMTP (`smtp-relay.brevo.com:587`) to `SITE_EMAIL` with reply-to set to the visitor's address, plus toast feedback. | "Built a responsive layout with separate desktop and mobile navigation, Next.js image handling (next/image), and a contact form with client-side validation that emails the business through a Next.js API route (Nodemailer + Brevo SMTP)." |
| b_atx_4 (GoDaddy hosting, shared hosting/DNS) | CONTRADICTED | Nothing in the repo mentions GoDaddy (grep found none). README on dev: "Vercel deploys `main` to production. Environment variables are set in the Vercel project." The stack line lists Vercel. Commit 31f7992 (2026-01-24) is "Trigger Vercel redeploy". The case study stack lists Vercel. The app needs a server runtime (API route), so it is not a static export (no `output: 'export'` in `next.config.ts`) and could not run on GoDaddy shared hosting as-is. There is no CI config in the repo. The domain registrar or DNS provider could be GoDaddy, but the repo can't show that. | "Deployed to production on Vercel with continuous deploys from `main` and environment-managed SMTP credentials; site live at atxreliablewrenching.com." Add DNS/GoDaddy only if the user confirms they set up the domain. |

### Measured stats worth using
- 9 services listed: `app/components/sections/services/serviceDetails.ts` (9 entries)
- 8 customer reviews shown: `grep -c author app/components/sections/reviews/reviewsDetails.ts` gives `8`
- Versions: Next.js 16.1.1, React 19.2.3, Tailwind v4, TypeScript 5, Nodemailer ^7.0.12, Embla ^8.6.0 (`package.json`)
- 94 commits across all branches (`git log --all --oneline | wc -l`): 75 in 2026-01 and 19 in 2026-09 (the redesign pass). First commit 2026-01-04, pre-redesign baseline 05ac805 on 2026-01-24.
- 93 of the 94 commits are from the user's account (`git shortlog -sne --all`; the other is from a second account belonging to the user, ReneMSdev). This supports sole development.
- `npm run lint`: ESLint printed no errors (2026-10-07, dev 7b291cd). The repo has no test suite. Build was not run.
- No animation libraries. Motion is CSS plus one IntersectionObserver (`app/components/ui/Reveal.tsx:20`) and is disabled under `prefers-reduced-motion` (README; `motion-reduce:` classes in Hero.tsx and BookNowBtn.tsx).

### New bullet material
- "Built a single responsive Next.js 16 / React 19 / TypeScript / Tailwind v4 marketing site for an Austin mobile-mechanic client, live at atxreliablewrenching.com." Evidence: package.json, README "Live:" line, case study `demoUrl`.
- "Implemented a serverless contact pipeline: validated form → Next.js API route → Nodemailer over Brevo SMTP, with reply-to set to the visitor and success/error toasts." Evidence: `app/api/contact/route.ts`, `ContactForm.tsx`.
- "Engineered a site-wide angled-panel design system in which every diagonal derives its offset from one shared angle (height × tan 25°) using rem-based sizes, so angles stay consistent at any screen or font size." Evidence: README "Diagonal edges" section, `--slant: 0.466` in globals.css, case study `lessonsLearned`, commit 5c52d65.
- "Added accessible motion (scroll reveal through IntersectionObserver, a seamless reviews marquee, hero zoom) with no animation library, all disabled under prefers-reduced-motion." Evidence: README "Motion", `Reveal.tsx`.
- "Kept a client-facing changelog that records each design change with its commit, previous values and revert command, so the client can roll back any change." Evidence: `CHANGELOG.md`, commit ee15a94.

### Needs the user
- Was this paid freelance work? The repo has no payment evidence. The `dev` LICENSE names ATX Reliable Wrenching as the owner and "identify the Owner by name as a client", which supports a real client relationship but not payment. If it was unpaid, use "Client Project" without "Freelance".
- GoDaddy: did you buy or manage the domain/DNS at GoDaddy and point it to Vercel? If so, "configured custom-domain DNS (GoDaddy → Vercel)" would be accurate. Otherwise remove GoDaddy completely.
- Did you do the visual design yourself? The Figma comment at `About.tsx:13` could mean your Figma file or one you were given.
- Are the 8 reviews copied word for word from the client's Google Business profile? The bullet should not imply a live feed.
- License conflict: `main` (the deployed branch) still has an MIT LICENSE under your name. The GitHub repo is `ReneMSdev/atx-reliable-wrenching`; I can't tell from the repo whether it is public. The `dev` LICENSE says the client owns the work and forbids publishing the full source. Merge `dev` to `main` and check the repo's visibility.
- I did not check whether the live site is up, its response, or its hosting (no external calls). Load atxreliablewrenching.com yourself before you say "live".
- The 8.4 MB hero source image (`public/images/engine.jpg`) weakens any "image-optimized" claim. Compress it before using that wording.

---

## Route Planning Web App
_Repo: ~/Dev/route-planner-nextjs @ working 15cc8e6; inspected 2026-10-07. `git diff --stat main working` shows no differences, so production (`main` 6cac2ad) has the same tree. The working tree is clean, and 83 commits run from 2025-05-10 to now. v1.1.0 is tagged._

### Bullet verdicts
| Bullet | Verdict | Evidence | Suggested fix |
|---|---|---|---|
| b_rp_1: multiple addresses, "optimal route", interactive map | OVERSTATED | The order comes from OpenRouteService's `/optimization` endpoint with one vehicle that starts at stop A. No end point is set (`src/app/api/optimize/route.js:26-33`), so the app never proves the route is optimal. The repo's own docs avoid the word "optimal": README says "finds an efficient stop order", and the case study says "an efficient order". If optimization fails, the app falls back to the order the stops were entered (docs/architecture.md, "When things go wrong"). Limits: 2–25 stops (`src/lib/routeInput.js:8` `MAX_STOPS = 25`) and US addresses only (`countrycodes` in `src/app/api/geocode/route.js:35`). The map is Leaflet via react-leaflet with OSM tiles (`src/components/MapDisplay/MapDisplay.js:3,82`). | "Built a route planner that geocodes up to 25 typed or imported (CSV/Excel) addresses, orders them efficiently with the OpenRouteService optimization API, and draws the driving route on an interactive Leaflet map." |
| b_rp_2: Google Maps export for mobile navigation | CONFIRMED, with a limit | `src/utils/generateGoogleMapsUrl.js` builds Google's documented `api=1` directions URL with `travelmode=driving`. There's an "Open in Google Maps" button, plus a QR code on desktop (`ExportModal.jsx`). docs/status.md says the user confirmed on an iPhone in production that the button opens the Google Maps app and the QR code scans (2026-10-02). Limit: the docs say Google allows about 9 stops between start and end, and this isn't handled in code, so long routes may open incomplete (docs/todo.md under "Suspected"; decisions.md 2026-10-02). PDF export also exists (jsPDF). | "Exported routes as a PDF or as a Google Maps link and QR code that opens turn-by-turn navigation on a phone." |
| b_rp_3: Next.js, JavaScript, Tailwind, OpenCage, ORS | CONTRADICTED (OpenCage) | `grep -rni opencage src README.md package.json` finds nothing. Geocoding moved to Nominatim after OpenCage rejected the key with a 401 (decisions.md, 2026-10-01). `/api/autocomplete`, the last OpenCage code, was deleted in 0bd7289. Next.js 15.5.27, React 19, Tailwind v4 and ORS are confirmed in `package.json` and README. | "Built with Next.js 15 (App Router), React 19, JavaScript, Tailwind CSS v4, shadcn/ui, Leaflet, OpenRouteService and Nominatim (OpenStreetMap); deployed on Vercel." |

### Measured stats worth using
- **Up to 25 stops per route.** `src/lib/routeInput.js:8` `MAX_STOPS = 25`; the geocode route also caps at 25 addresses.
- **Per-visitor rate limit of 10 requests a minute and 100 a day per API route, plus a same-origin check (403 otherwise).** `src/lib/apiGuard.js:10-13`. docs/status.md records a production test where a foreign `Origin` got a 403 (2026-10-02). The 429 limit was only exercised locally, in a curl run of 10×200 then a 429 with `Retry-After`.
- **3 server-side API routes** (`geocode`, `optimize`, `route`) proxy the external services, and the ORS key is read only on the server. `ls src/app/api` shows the 3 routes; README and architecture.md describe the proxy.
- **Nominatim lookups spaced at least 1.1 s apart, with an in-memory cache.** `src/app/api/geocode/route.js:8` `MIN_INTERVAL_MS = 1100`.
- **Stops snap to a road up to 1 km away (ORS's default is 350 m), so all 43 demo stops route in one call.** decisions.md 2026-10-01; status.md "Demo addresses" row.
- **Live at https://route-planner-nextjs.vercel.app.** README; docs/architecture.md "Deployment" section; status.md says Vercel Production status `success` for 864dc59.
- **Imports CSV, XLS or XLSX files (up to 1 MB), with flexible header matching.** README "Features"; status.md "Import parser" row (36/36 offline cases, scripts not kept in the repo).
- **Lint passes.** `npm run lint` (2026-10-07): "No ESLint warnings or errors".
- Avoid speed claims. The only timings recorded are ORS optimize taking 15.2 s on 2026-10-01 and about 40 s in production on 2026-10-02 (docs/todo.md). Both are slow cases, not good ones.

### New bullet material
- "Kept the OpenRouteService API key server-side by proxying all geocoding and routing through Next.js API routes. Added same-origin checks, per-IP rate limits (10/min, 100/day) and input validation to protect free-tier API quotas." Evidence: `src/lib/apiGuard.js`, `src/lib/routeInput.js`, decisions.md 2025-08-19; status.md says 14 bad requests including 4 injection attempts all got a 400.
- "Swapped geocoding and map tiles to keyless OpenStreetMap services (Nominatim, OSM tiles) after the original providers began rejecting requests. Followed Nominatim's usage policy with request spacing, caching and an identifying User-Agent." Evidence: decisions.md 2026-10-01 (OpenCage 401; CARTO tiles started needing a key); `src/app/api/geocode/route.js:5-8`.
- "Built a responsive layout with a Stops/Map switch on phones and resizable columns on larger screens. Fixed iPhone-specific issues: page scroll and pull-to-refresh, a blank map after a layout switch, and keeping dragged stops inside the list." Evidence: commits d1bd170, 939c82f, ef2e853, d5d40a8; status.md says the user checked these on an iPhone in production.
- "Added drag-to-reorder stops (dnd-kit, touch included) and CSV/Excel import with flexible header matching." Evidence: `package.json` (@dnd-kit/*, papaparse, xlsx, react-dropzone); README "Features"; todo.md "Done" says touch drag was confirmed on an iPhone.
- Optional context bullet from the case study: the app came out of a real problem in the user's fiber optic field work. Source: `~/Dev/portfolio-website/src/data/projects.ts` description, which the user wrote.

### Needs the user
- **Tests:** don't claim any. There's no test suite and no CI workflow (`.github/workflows` doesn't exist; status.md "Tests | none"; adding both is open in todo.md).
- **"Optimal":** OK to drop it for "efficient"? The repo never measures route quality against the original order or any baseline, so no "X% shorter" stat is possible without a new measurement.
- **Stack line:** the entry title says "Next.js, JavaScript". Add React 19, Leaflet and Vercel, and swap OpenCage for Nominatim?
- **Usage numbers:** real-world use, users or routes planned aren't recorded anywhere, so leave them out unless you have them.
- **Rate limits:** they're in-memory per server instance (architecture.md, "Server-side state and limits"). If an interviewer asks, describe them as basic abuse protection, not hard limits.
- **AI help:** the case study's lessonsLearned frames this as an early, self-taught project. Most of the 2026 hardening (guards, mobile fixes, provider swap) was done in AI-assisted sessions according to the docs. Decide how you want to present that split.

---

## Weather Alerts API Backend
_Repo: ~/Dev/weather-alerts-backend @ main cd171ba; inspected 2026-10-07_

Branches: no other branch has newer work. `git rev-list --count main..<b>` returns 0 for feature/icon, origin/add-location, origin/feature/db, origin/feature/icon and origin/remove-location. There are 32 commits, dated 2025-11-07 to 2025-11-22. `npx tsc --noEmit` exits 0. There are no tests: package.json has `"test": "echo \"No tests yet\""`, and the test step in CI is commented out. A `.env` file exists locally but is gitignored and not tracked; its values were not read.

### Bullet verdicts
| Bullet | Verdict | Evidence | Suggested fix |
|---|---|---|---|
| b_wa_1 | CONTRADICTED | **Redis:** `src/config/redis.ts` is one comment line (`// Redis client configuration`). `ioredis` is in package.json but is never imported anywhere. `git grep` for `ioredis`, `new Redis` and `cron.schedule` across all branches finds nothing. TODO.md lists "[ ] Add Redis Cashing ... TTL ex: 15 min" as still to do. So there are no cache keys and no TTL. **node-cron:** `src/cron/weatherSync.ts` and `src/cron/alertCheck.ts` are one comment line each, and nothing imports node-cron. **~40% faster:** no benchmark, log or note anywhere. The forecast is fetched live from NWS on every request (`src/services/nws.service.ts:14-32`). **Production-ready:** no tests, no auth, logging is `console` only, input checks are hand-written presence checks, rate limiting covers only `/autocomplete`, and push, alerts, env and db config are empty stubs (`src/services/push.service.ts`, `src/controllers/alert.controller.ts` with 0 lines, `src/config/env.ts`). PostgreSQL is real (`src/db/client.ts`, `src/db/schema.ts`). | Remove Redis, cron, "~40% faster" and "production-ready". Suggested: "Built a REST API (Express 5, TypeScript, PostgreSQL via Drizzle ORM) that geocodes US cities with Google, resolves NWS forecast grids, and returns normalized forecasts. Each city's geocode and grid lookup is stored in Postgres, so later requests skip those two external calls." |
| b_wa_2 | CONFIRMED (minor wording) | `.github/workflows/actions.yaml`: runs on push and pull_request to `main`. The `build` job does checkout, then setup-node 24 with npm cache, then `npm install`, then `npm run build` (`tsc`). The `deploy` job has `needs: build` and `if: github.ref == 'refs/heads/main'`, and runs `curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"`. There is no render.yaml. Whether Render actually deployed could not be seen (no access). | The deploy runs on any push to main, not only merges. Suggested: "CI/CD with GitHub Actions: a TypeScript build gate on every push and PR to main, and a Render deploy hook that runs only on main after the build passes." |
| b_wa_3 | CONFIRMED (partial) | The companion repo `~/Dev/WeatherAlertsRN` (branch feature/detail, 6a8a5dd) uses expo ~54.0.23 and react-native 0.81.5, and its app.json has `ios` and `android` blocks. Calls to the backend: `app/city/[name].tsx:50` (GET weather by city), `app/index.tsx:51` (POST device registration), `hooks/useAutocomplete.tsx:21` (POST autocomplete). Not confirmed as built or run on real iOS/Android devices. | Keep, but say exactly what it uses: "Designed the API consumed by my React Native (Expo) app for city search autocomplete, device registration and city forecasts." |

### Measured stats worth using
- 7 API endpoints plus a health route `GET /`: `GET /weather/:city`, `GET /weather/devices/:deviceId`, `POST /devices`, `POST /devices/:deviceId/locations`, `DELETE /devices/:deviceId/locations/:cityId`, `GET /devices/:deviceId/locations`, `POST /autocomplete`. Sources: `src/app.ts:15-26`, `src/routes/weather.routes.ts:8,11`, `src/routes/device.routes.ts:14-23`, `src/routes/autocomplete.routes.ts:53`. The alerts router is commented out (`src/app.ts:29`).
- 3 Postgres tables: `locations` (city_id unique, place_id, lat/lon, NWS grid_id/x/y, timezone), `devices` (device_id, platform, os_version, push_token), and a many-to-many join table `devices_to_locations` with a composite PK and 2 foreign keys. Sources: `src/db/schema.ts:13-59`. There are 2 Drizzle migrations (`drizzle/0000_nosy_tempest.sql`, `drizzle/0001_conscious_mister_fear.sql`).
- 3 external APIs: NWS points and gridpoints forecast (`src/services/nws.service.ts:9-10`), Google Geocoding (`src/services/geo.service.ts:7`), and Google Places Autocomplete (New) restricted to US cities (`src/routes/autocomplete.routes.ts:69-75`). No OpenWeather.
- Rate limit: 50 requests per minute on `/autocomplete`, keyed by sessionToken with IP fallback, using express-rate-limit in memory (not Redis). Source: `src/routes/autocomplete.routes.ts:11-12,40-48`. The sessionToken key is supplied by the client, so this is easy to bypass.
- A device's forecasts for all its saved cities are fetched in parallel with `Promise.all`. Source: `src/controllers/weather.controller.ts:43`.
- Auth: none. Guest device IDs only (TODO.md: "[x] device id for guest users", Clerk not started).

### New bullet material
- "Designed a normalized PostgreSQL schema (Drizzle ORM, versioned migrations) with a many-to-many devices-to-locations model, so guest users can save, list and remove cities without an account." Evidence: `src/db/schema.ts:47-59`, `src/controllers/device.controller.ts:43-144`, `drizzle/*.sql`.
- "Combined Google Geocoding with the National Weather Service points and gridpoints APIs, storing each city's coordinates and forecast grid in Postgres so repeat lookups skip both external calls." Evidence: `src/services/location.service.ts:80-106`.
- "Added a server-side proxy for Google Places Autocomplete with per-session rate limiting, so the API key never ships in the mobile app." Evidence: `src/routes/autocomplete.routes.ts:40-63`. The proxy and rate limit are in code; "keeps the key out of the client" is inferred from the design.
- "Mapped NWS forecast periods to a simpler mobile-friendly response, with weather icons chosen from the forecast text." Evidence: `src/services/transformWeather.ts`, `src/services/icon.service.ts:26-38`. transformWeather was not read in detail.

### Needs the user
- Was this ever deployed and live on Render? The workflow has a deploy hook, but Render and the GitHub Actions run history aren't visible from the repo.
- The "~40% faster" figure has no source in the repo, and since there is no cache, nothing could have produced it. Drop it unless you have a measurement from somewhere else.
- Did the Expo app actually run on both iOS and Android devices or simulators, or only one?
- Do you plan to finish the Redis cache, cron alert checks or Expo push notifications before sending applications? Until then they can't be claimed. The README (`README.md:11-13`) also claims Redis, node-cron and Expo push, which the code doesn't support. Worth fixing if the repo is public.

---

## React Native Weather App
_Repo: ~/Dev/WeatherAlertsRN @ feature/detail 6a8a5dd; inspected 2026-10-07_

Branches: `main` and `feature/auto` both end at 9dd8316. `feature/login` ends at 1f35aa7. `feature/detail` (HEAD) is the furthest along: `git diff --stat main..feature/detail` shows 7 files, +109/−18, mostly the detail screen fetch in `app/city/[name].tsx` plus deleted boilerplate logos. All 25 commits fall between 2025-11-15 and 2025-11-21. The working tree was clean.

### Bullet verdicts
| Bullet | Verdict | Evidence | Suggested fix |
|---|---|---|---|
| b_wam_1 cross-platform iOS/Android app | OVERSTATED | Expo managed project. `app.json` has `ios` and `android` blocks, and package.json has `"android"`/`"ios"` scripts (`expo start --android/--ios`). But there is no `eas.json`, no `ios/` or `android/` folders (both gitignored), and no CI. `.expo/devices.json` is `{"devices": []}`. Nothing shows a build or a run on either platform, and there are no store listings. The app is an early prototype: 3 screens plus a detail route, and the home city list is hardcoded mock data (`components/CityList.tsx:3-36`, "Test Values"). | "Building a cross-platform mobile app (React Native, Expo Router, TypeScript) targeting iOS and Android; in progress." Only say "runs on iOS and Android" if you've actually run it on both. |
| b_wam_2 custom Node/Express backend, real-time weather + severe weather warnings | OVERSTATED (the warnings part is CONTRADICTED) | The backend link is real. `.env` points all three URLs at `weather-alerts-backend.onrender.com` (`/devices`, `/autocomplete`, `/weather`), which match `~/Dev/weather-alerts-backend/src/app.ts:20-26`. The app calls three endpoints: POST `/devices` (`app/index.tsx:51`), POST `/autocomplete` (`hooks/useAutocomplete.tsx:21`), and GET `/weather/:city` (`app/city/[name].tsx:50`). Weather loads once when the detail screen mounts: no polling, no refresh, no push. There are **no severe weather warnings**: the alerts route is commented out (`backend src/app.ts:29`), `push.service.ts`, `cron/alertCheck.ts` and `alerts.routes.ts` are each a single comment line, and `StormWatch` is a hardcoded "No active alerts" placeholder that is commented out of Home (`app/(tabs)/home.tsx:92`). `pushToken: null` is sent (`app/index.tsx:60`). | "Integrated the app with my own Node/Express backend (deployed on Render) for device registration, US city autocomplete, and current conditions plus forecast from the National Weather Service." Drop "real-time" and "severe weather warnings". |
| b_wam_3 React hooks + AsyncStorage for device and location persistence | OVERSTATED | Hooks: useState/useEffect throughout, a custom `useAutocomplete` hook (debounced 300 ms, AbortController cleanup, `hooks/useAutocomplete.tsx:11,19,44`), and a Context-based `ThemeProvider` (`hooks/useTheme.tsx:96-123`). AsyncStorage stores three things: `deviceId`, a UUID v4 (`utils/deviceId.ts:8-14`); `loggedIn` (`app/index.tsx:34,64`, `settings.tsx:23`); and `darkMode` (`useTheme.tsx:105,113`). **No locations are persisted anywhere.** No location permission or expo-location exists, and TODO.md lists "Permissions / Location requests" as unchecked. | "Managed state with React hooks and Context, and persisted a generated device ID, guest session flag, and dark-mode preference with AsyncStorage." |
| b_wam_4 ~55% faster via multithreading / parallel API requests | CONTRADICTED | The app has no `Promise.all`, worker, or thread code: grep over app/components/hooks/utils on all local branches returned no matches. Each screen makes at most one request. There is no benchmark, timing code, or test anywhere, so nothing supports "~55%". The only `Promise.all` is in the **backend** (`weather-alerts-backend/src/controllers/weather.controller.ts:43`, fetching weather for all of a device's saved locations in parallel), and the app never calls that endpoint (`/weather/devices/:deviceId`). "Multithreading" is wrong in both places: it's concurrent async I/O on a single-threaded JS event loop. | Delete this bullet. If wanted, claim it under the backend project instead: "Fetched weather for all of a device's saved locations concurrently with Promise.all." Leave out the percentage. |

### Measured stats worth using
- Type-check is clean: `npx --no-install tsc --noEmit` exits 0, no output (2026-10-07).
- Lint reported no errors or warnings: `npx --no-install expo lint` printed only its env-loading lines.
- 3 backend endpoints used by the app: `/devices`, `/autocomplete`, `/weather/:city` (file:line references above).
- Autocomplete is debounced at 300 ms with a 3-character minimum (`hooks/useAutocomplete.tsx:11,17`).
- Screens: splash/guest login (`app/index.tsx`), Home and Settings tabs (`app/(tabs)/_layout.tsx`), and a city detail route (`app/city/[name].tsx`). Navigation uses Expo Router stack plus bottom tabs (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`).
- No tests exist (no test files, no test script in package.json), so don't claim test coverage.

### New bullet material
- "Built guest onboarding that generates a persistent device UUID and registers the device (platform and OS version) with the backend, with auto-login on later launches." Evidence: `utils/deviceId.ts:5-24`, `app/index.tsx:31-66`.
- "Implemented debounced city search autocomplete with request cancellation (AbortController) to avoid stale results." Evidence: `hooks/useAutocomplete.tsx:11-45`.
- "Added a light/dark theme system using React Context, defaulting to the OS appearance and saving the user's choice." Evidence: `hooks/useTheme.tsx:98-114`.
- "Built a typed city detail screen showing NWS current conditions and a multi-day forecast, with loading and error states." Evidence: `app/city/[name].tsx:10-60`.

### Needs the user
- Have you actually run the app on an iOS device or simulator and on an Android device or emulator, e.g. via Expo Go? The repo has no record either way.
- Where did "~55%" come from? Nothing in either repo measures load time. Unless you have a real before/after measurement, drop it.
- Is the Render deployment (`weather-alerts-backend.onrender.com`) still live? No network calls were made.
- How should the entry be framed? The work spans 7 days (2025-11-15 to 11-21), the home list is mock data, and alerts/push/location are unbuilt. "In progress" or "prototype" would be accurate.
- Should the backend's `Promise.all` multi-location fetch (and the NWS integration) go under the backend project entry instead of this one?

---

## LinkLeaf (Salo Labs LLC)
_Repo: ~/Dev/linkleaf-mono @ working c169dc4; inspected 2026-10-07_

### Bullet verdicts
| Bullet | Verdict | Evidence | Suggested fix |
|---|---|---|---|
| b_salo_1 | OVERSTATED | Nothing on GCP was ever provisioned or deployed. README.md: the Dockerfile "hasn't been built or deployed yet" and the backend "has never been deployed". docs/status.md: "Docker image builds: **unverified**". The Flutter app is "a UI prototype on mock data", not wired to the API (README "Mobile"). The repo has no IaC: no terraform, cloudbuild or service.yaml. | "Designed and built LinkLeaf, a QR-code digital business card: a tested FastAPI/PostgreSQL backend (Docker image targeting Cloud Run) and a Flutter UI prototype." |
| b_salo_2 | CONTRADICTED | (a) It is one service, a modular monolith (`app/main.py`, a single uvicorn app in `entrypoint.sh`). (b) It was never deployed to Cloud Run and Cloud SQL was never provisioned. The archived `qr_backend/PROJECT_STATUS.md:210-212` lists Cloud Run and Cloud SQL as unchecked `[ ]`, and `docs/todo.md:13` now plans Neon/Supabase "instead of Cloud SQL". (c) dev/staging/production exist only as config: the `AppEnv` enum (`settings.py:8-12`) and `mobile/.env.example`. The portfolio entry says "only development ever ran". (d) The two-bucket split with signed URLs is real in code (`core/storage.py`, decisions.md "There are two buckets... 60-minute signed URLs"). (e) Firebase token verification is real in code, but it was never run against live Firebase (entry.md section 3). | "Designed a FastAPI modular-monolith API with Firebase token verification, a UID allowlist that fails closed in staging/prod config, and public/private GCS buckets with on-demand 60-minute signed URLs for private files." |
| b_salo_3 | CONTRADICTED | `.github/workflows/backend.yml` is the only workflow. It runs tests on push to main and on PRs, with a `postgres:16` service container. That part is true. There is no deploy workflow. The old `deploy.yml` was a stub that only ran `echo "Deployment to Cloud Run will be configured here"` (`git show b0124af`), and it was deleted in 120cdc2. | "Built a GitHub Actions CI pipeline that applies Alembic migrations to a PostgreSQL 16 service container, runs the async API test suite, and fails the build below 50% coverage. It needs no repository secrets because it generates a throwaway service-account key." |
| b_salo_4 | OVERSTATED (minor) | `backend/Dockerfile` is a 2-stage build (builder and runtime) with a non-root user. `entrypoint.sh` runs `alembic upgrade head` and then `exec uvicorn`. All of that is accurate, but the image has never been built (status.md: "Docker image builds: unverified"). | Keep it, but say "Wrote a multi-stage Dockerfile (non-root runtime) with an entrypoint that runs Alembic migrations before startup". Build the image once before claiming more. |
| b_salo_5 | OVERSTATED | 133 tests is right: `pytest --collect-only -q` returns "133 tests collected" (130 `def test_` plus parametrized cases). "100+ passing" holds per the last recorded runs (CI run 36531743990 at 905a8f1: 133 passed, 64.55%, per docs/status.md). Not re-run today: Postgres on localhost:5432 gave no response and Docker was down. There are 8 test files, not 7: auth, contacts, links, media, profiles, subscriptions, themes, users. The app has 7 functional domains plus an empty `organization` stub. "Fully mocked" is roughly right: auth goes through `dependency_overrides`/`patch(verify_token)` and storage through `patch` in `test_media.py`. The threshold is real but low: `--cov-fail-under=50` (`backend.yml`, last step). It runs only on backend-path pushes to main and on PRs, not on "every push". | "Wrote 133 async API tests (pytest + httpx) across 8 modules against a real PostgreSQL database, with Firebase and GCS mocked. CI enforces a 50% coverage floor (currently about 65%)." |
| b_salo_6 | OVERSTATED | Coverage is 64.55%, not "full". status.md lists services at 30-44% (`profile/service.py` 34%, `user/service.py` 30%, `theme/service.py` 44%). There was no "deployment" for the tests to come before. A known untested bug is open: restore doesn't check the plan (status.md, Known issues). | Drop it, or merge it into b_salo_5. If kept: "Wrote endpoint-level tests for auth, profiles, links, contacts, media, themes and subscription webhooks." |
| b_salo_7 | OVERSTATED | Structured logging exists: `app/config/logging.py` uses structlog, with JSON output outside development, and `main.py:52-63` has request-logging middleware (method, path, status, duration_ms). It is only used in `main.py` and `api/subscriptions.py`. Two leftover `print()` calls remain in `auth/dependencies.py:135,137`. Nothing was ever "monitored" because nothing ran in production, and there were no "releases". | "Added structlog structured logging (JSON in non-dev environments, per-request timing middleware) for Cloud Logging." Drop "monitor system behavior" and "release quality". |

### Measured stats worth using
- 133 tests collected: `.venv/bin/pytest --collect-only -q` returned "133 tests collected in 0.11s" (c169dc4, 2026-10-07). The last recorded pass is 133 passed, 64.55% coverage in CI run 36531743990 (docs/status.md). Not re-run today.
- CI coverage floor of 50%: `.github/workflows/backend.yml`, step `pytest tests/ --cov=app --cov-fail-under=50`.
- 32 API endpoints: importing `app.main` and counting `APIRoute`s gives 33, minus `/health`. This matches entry.md.
- 8 test modules (`ls backend/tests`). Tests per file: auth 8, contacts 15, links 21, media 18, profiles 24, subscriptions 17, themes 20, users 7 (`def test_` counts).
- Backend commits by month: 62 in 2026-03, 62 in 2026-04, 6 in 2026-09. The first commit is 2026-03-17 (`git log`).
- Mobile: 38 Dart files, about 3,331 lines in `lib/` (`find | xargs cat | wc -l`).

### New bullet material
- "Integrated RevenueCat subscription webhooks that map purchase, renewal, cancellation and expiration events to plan changes. On expiration, extra profiles and premium media are soft-deleted with a 30-day restore window." Evidence: `api/subscriptions.py` (EVENT_MAP), `GRACE_PERIOD_DAYS = 30` in `core/types.py`, entry.md sources table. Caveat: never tested against live RevenueCat.
- "Designed permanent QR links: an immutable token redirects to the profile's current slug, and old slugs return a 301, so printed cards survive renames." Evidence: `api/profiles.py` (`qr_redirect`, `get_public_profile`), decisions.md 2026-09-28.
- "Built a public 'Save Contact' vCard 3.0 download, with a branding note on free-tier cards." Evidence: `api/contacts.py`, `domain/contact/service.py`.
- "Server-side image pipeline: Pillow converts uploads to WebP, file types are checked from file bytes with python-magic, and size limits are 10 MB for images and 5 MB for résumés." Evidence: README "Media", decisions.md imported entry.
- "Locked down a pre-launch API with a Firebase UID allowlist (403 for unlisted accounts, no user row created) that refuses to start in staging/prod with an empty list. The failing paths are covered by tests." Evidence: decisions.md 2026-09-29, `settings.py:62-67`, `tests/test_auth.py`.
- Mobile, phrased as a prototype: "Built a Flutter UI prototype with a draggable profile card sheet, an animated QR code (qr_flutter), an edit mode, and a free/premium layout. It runs on mock data." Evidence: README "Mobile", `pubspec.yaml`.

### Needs the user
- The role is dated "January 2026", but the first LinkLeaf commit is 2026-03-17. Was there earlier work, or did the LLC start before the code? Backend work also stops after 2026-04 until the September portfolio cleanup, so "Present" for active development needs a decision.
- Did you ever provision real GCP resources, such as the dev buckets `qr-app-media-public-dev` / `qr-app-media-private-dev` (archived `PROJECT_STATUS.md:352`) or the Firebase project? The repo only shows names, not that they exist. If they were real and used in local dev, a bullet could say "integrated with GCS dev buckets".
- Keep the title "Software & DevOps Engineer"? There was no deploy, IaC or production ops. The DevOps evidence is limited to the CI pipeline, the Dockerfile and environment config.
- Re-run the test suite (start Postgres or Docker) and build the Docker image before applying? Both would turn the current "last recorded" claims into fresh ones.

---

## Summary (2026-10-07)

| Entry | Confirmed | Overstated | Contradicted |
|---|---|---|---|
| LinkLeaf / Salo Labs (7) | 0 | 5 (b_salo_1, 4, 5, 6, 7) | 2 (b_salo_2, 3) |
| Route Planner (3) | 1 (b_rp_2, with a limit) | 1 (b_rp_1) | 1 (b_rp_3: OpenCage) |
| ATX Reliable Wrenching (4) | 0 | 3 (b_atx_1, 2, 3) | 1 (b_atx_4: GoDaddy) |
| Weather Alerts API Backend (3) | 2 (b_wa_2, 3) | 0 | 1 (b_wa_1: Redis, cron, ~40%) |
| React Native Weather App (4) | 0 | 3 (b_wam_1, 2, 3) | 1 (b_wam_4: multithreading, ~55%) |
| **Total (21 checked)** | **3** | **12** | **6** |

**Patterns across projects:**
- **Unmeasured percentages.** Every "~X% faster" claim the agents could check (weather backend ~40%, weather app ~55%) has no measurement behind it. The freelance bullets (~30%, ~10%, ~25%, ~30%, ~20%) follow the same pattern and can't be checked from any repo.
- **Planned features described as built.** Redis, cron jobs, push alerts, Cloud Run deploys and dev/staging/prod environments exist only as stubs, config or TODOs.
- **Undersold real work.** Every project has accurate, specific material that isn't on the resume: LinkLeaf's 133 tests, 32 endpoints, QR permalinks and RevenueCat webhooks; Route Planner's API protection and provider swap; ATX's contact email pipeline; the weather backend's schema and NWS integration.

**Not reviewed by any agent:** the freelance bullets (b_fl_1–7: Ecobridge, the life-coach site) and the technician roles (SandCastle, Polaris, Unmuted, DCOMM). Polaris and Unmuted bullets contain specific numbers ($2.3M ARR, ~15%, 400+ homes, 20+ incidents) that only the user can confirm.
