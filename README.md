# Closeby

**See who's around. Connect when it feels right.**

Closeby is a map-first social discovery app for staying connected with friends and discovering new people nearby. It is designed around opt-in presence, deliberately approximate location, mutual connection requests, messaging, and eventually voice/video calling.

## Project status

Closeby is **App #11** in the shared Supabase Project Hub and owns only the isolated `closeby` database schema. The original interaction prototype remains the default production experience while the real-user client is staged behind `?live=1` until the Project Hub Data API explicitly exposes only the `closeby` schema.

### V0 prototype — live

- Interactive discovery map
- Browser geolocation with graceful demo fallback
- Approximate nearby user markers
- Search by people or interests
- Profile previews and interests
- Connection request flow
- Existing connections view
- Local prototype messaging
- Discoverability/privacy toggle
- Responsive desktop and mobile UI

### V1 real-user client — staged

- Email/password authentication
- Profile onboarding
- 18+ discovery confirmation
- Opt-in visibility modes
- Privacy-preserving presence updates
- Nearby discovery against `closeby.discover_nearby`
- Incoming/outgoing connection requests
- Accepted connections
- Database-backed messaging with polling
- Read state
- Block/report flows
- Desktop and mobile live UI

## Backend

The Project Hub migration creates only `closeby.*` resources:

- `closeby.profiles`
- `closeby.presence`
- `closeby.connections`
- `closeby.messages`
- `closeby.blocks`
- `closeby.reports`

All user-facing tables have Row Level Security enabled. Anonymous database access is not granted. Sensitive mutations are performed through authenticated, Closeby-scoped RPCs.

## Location privacy

Closeby never stores the raw GPS coordinates supplied by the browser in its user-facing presence table. The authenticated presence RPC validates the caller and quantizes coordinates before storage. Discovery returns the coarse location plus a distance band; blocked and invisible users are removed from discovery.

This is intentionally different from a precise live-location tracker.

## Stack

- React + Vite
- Leaflet / React Leaflet
- Lucide icons
- Carto / OpenStreetMap-based map tiles
- Supabase Auth + PostgreSQL
- Shared Supabase Project Hub with isolated `closeby` schema
- Vercel

### Planned communication layer

- LiveKit for voice/video calling
- Realtime/Broadcast or an equivalent scoped transport for lower-latency chat and presence after the core data flow is proven

## Repository safety boundary

Read these before any Project Hub change:

- `AGENTS.md`
- `SUPABASE_HUB_RULES.md`

Closeby must not modify another app's schema or ordinary Project Hub shared configuration without explicit approval.

## Run locally

```bash
npm install
npm run dev
```

Default V0 prototype:

```text
http://localhost:5173/
```

Staged real-user client:

```text
http://localhost:5173/?live=1
```

Production build:

```bash
npm run build
```

## Roadmap

### V0 — interaction prototype
Map, profiles, connection flow, friends, messaging UI and privacy controls.

### V1 — real users
Authentication, onboarding, secure approximate presence, nearby discovery, connection requests, persisted chat, blocks and reports.

### V2 — communication
LiveKit voice/video calls, typing indicators, read receipts, notifications and richer friend presence.

### V3 — discovery
Interest filters, map clustering, city/world zoom, group huddles and contextual discovery.

---

Built as an original social discovery product focused on presence without precise tracking.
