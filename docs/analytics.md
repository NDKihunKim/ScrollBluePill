# Analytics & Monitoring Guide for ScrollBluePill

This guide covers everything you need to understand how visitors use the site,
catch errors in production, monitor performance, and know when the site is down.

## Quick Reference

| What | Where | Setup |
|------|-------|-------|
| Page views & traffic | Cloudflare Dashboard → Web Analytics | Enable toggle (one-time) |
| Calculator usage events | Custom beacon (`/cdn-cgi/rum`) | Already active in code |
| Frontend errors | Custom beacon + BaseLayout listener | Already active |
| Performance audits | Lighthouse CI (GitHub Actions) | Runs on every push to main |
| Uptime/downtime | UptimeRobot (free tier) + `/healthz` | 5-minute setup below |

---

## 1. Cloudflare Web Analytics — Page Views & Traffic

### Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select **ScrollBluePill** from your Pages projects
3. Click the **Web Analytics** tab in the sidebar
4. Click **Enable Web Analytics**
5. Done — Cloudflare injects the analytics beacon at the edge automatically.
   No code changes needed.

### What you can see

- **Page views** — how many visits, which pages
- **Top paths** — which calculators get the most traffic
- **Countries / regions** — where your users are
- **Device types** — desktop vs mobile split
- **Referrers** — where traffic comes from
- **Core Web Vitals** — LCP, FCP, CLS, TTFB for real users

### How to check

Go to Cloudflare Dashboard → ScrollBluePill → **Analytics** tab.
Data appears within minutes of enabling.

---

## 2. Custom Events — Calculator Usage & Errors

### How it works

The site sends lightweight, privacy-first beacons using `navigator.sendBeacon()`
to Cloudflare's built-in RUM endpoint (`/cdn-cgi/rum`). These are fire-and-forget
— they never block page navigation and never collect personal data.

### What events are tracked

| Event name | When it fires | Payload |
|-----------|---------------|---------|
| `deconstruction_analysis` | User completes a deconstruction analysis | `{ strategyCount, sourceTypes }` |
| `ev_computation` | User completes an expected-value computation | `{ probability, mode }` |
| Error | Any uncaught JS error or rejected promise | `{ message, source, lineno, colno, stack }` |

### How to view custom events

Custom events appear in the Cloudflare Web Analytics dashboard under
**Analytics → Events**. Look for the event names listed above.

Alternatively, open your browser's **Network** tab while using the site
locally — you'll see `POST /cdn-cgi/rum` requests firing with JSON
payloads when you run a calculator or when an error occurs.

### Adding new events

In any page or module, import and call:

```js
import { trackEvent } from '../lib/beacon.mjs';

trackEvent('my_event_name', { key: 'value' });
```

Keep event names descriptive and payloads minimal — no PII, no large objects.

---

## 3. Error Monitoring — Uncaught Frontend Errors

### How it works

`src/layouts/BaseLayout.astro` includes a global error listener that catches
all `window.onerror` and `unhandledrejection` events and beacons them. You
don't need to add try/catch blocks — any uncaught error in production
automatically sends a report.

### What gets reported

- Error message
- Script URL where the error occurred
- Line and column numbers
- Stack trace (first 500 characters)

### How to view errors

1. **Cloudflare Web Analytics** — errors appear as events in the Analytics
   dashboard
2. **Browser DevTools** (local testing) — open Network tab, filter for
   `/cdn-cgi/rum`, trigger `throw new Error('test')` in the console to
   confirm the beacon fires

### Testing error reporting

1. Open the site locally (`npm run dev`)
2. Open browser DevTools → Network tab
3. In the console, type: `throw new Error('test beacon')`
4. Look for a `POST /cdn-cgi/rum` request — confirm it contains the error
   details

---

## 4. Uptime Monitoring — Know When the Site Is Down

### How it works

The site has a `/healthz` page that returns `{"status":"ok"}`. An external
uptime monitor checks this page on a schedule and alerts you if it doesn't
return 200.

### Setup (UptimeRobot, free tier)

1. Go to [uptimerobot.com](https://uptimerobot.com/) and sign up (free)
2. Click **Add New Monitor**
3. Choose type: **HTTP(s)**
4. Set URL to: `https://scrollbluepill.pages.dev/healthz/`
5. Monitoring interval: **5 minutes** (free tier default)
6. Alert contacts: add your email (or Slack/Discord if preferred)
7. Click **Create Monitor**

The free tier allows 50 monitors with 5-minute checks — more than enough.

### Alternative: Better Stack

[Better Stack](https://betterstack.com/) also has a generous free tier
and includes a nicer dashboard. Same setup: monitor `https://scrollbluepill.pages.dev/healthz/`.

### What you get

- Email/Slack alert within 5 minutes of the site going down
- Uptime percentage over time
- Response time graphs

---

## 5. Lighthouse CI — Performance Audits

### How it works

Every push to `main` (and every PR) triggers a GitHub Actions workflow that:
1. Builds the production site
2. Runs Lighthouse against 5 key pages
3. Checks performance, accessibility, best-practices, and SEO scores
4. Posts results as a GitHub Actions summary

### Where to see results

1. Go to the [GitHub repo Actions tab](https://github.com/NDKihunKim/ScrollBluePill/actions)
2. Click the latest **Lighthouse CI** workflow run
3. Expand the **Run Lighthouse CI** step to see scores for each page
4. A temporary public link is generated with full Lighthouse reports

### Running locally

```bash
npm run build:ci   # build the site first
npm run lhci       # run lighthouse against the dist/ folder
```

### Score thresholds (current)

| Category | Warn threshold |
|----------|---------------|
| Performance | < 70 |
| Accessibility | < 85 |
| Best Practices | < 85 |
| SEO | < 85 |

These are set to **warn** (not block) — you'll see alerts in CI but deploys
won't be prevented. To make them stricter (blocking), change `warn` to `error`
in `lighthouserc.mjs`.

### Pages audited

- `/` (landing page)
- `/deconstruction/` (main calculator)
- `/expected-value/` (EV calculator)
- `/guides/` (guide index)
- `/methodology/` (methodology page)

To add more pages, edit the `url` array in `lighthouserc.mjs`.

---

## 6. Privacy Summary

| Aspect | Approach |
|--------|----------|
| Cookies | **None** — CWAs and beacons are cookieless |
| PII | **None collected** — no IP logging, no fingerprinting, no user IDs |
| Data retention | Cloudflare retains CWAs data for 30 days (free tier) |
| GDPR | Compliant out of the box — no consent banner needed |
| Third parties | Only Cloudflare (your hosting provider) |

The beacon utility (`src/lib/beacon.mjs`) sends only event names and
minimal metadata — no URLs, no user input, no identifiable information.

---

## 7. Maintenance Checklist

**Weekly (5 min):**
- Open Cloudflare Dashboard → Web Analytics → check traffic patterns
- Look for any spike in error events

**After each deploy:**
- Check the Lighthouse CI run on GitHub Actions
- If scores dropped, investigate before merging

**Monthly (10 min):**
- Review uptime report in UptimeRobot
- Review calculator completion events — are users actually using both tools?

**When adding new features:**
- Add a `trackEvent()` call for any new "completion" action
- Add the new page to the `lighthouserc.mjs` URL list if it's a core page
