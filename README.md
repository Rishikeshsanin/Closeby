# Closeby

**See who's around. Connect when it feels right.**

Closeby is a map-first social discovery app for staying connected with friends and discovering new people nearby. It is designed around opt-in presence, deliberately approximate location, mutual connection requests, messaging, and eventually voice/video calling.

## Project status

Closeby is **App #11** in the shared Supabase Project Hub and owns only the isolated `closeby` database schema.

The **real-user V1 client is now the default production experience**. The original interaction prototype is preserved at `?demo=1` as a reference/rollback view.

### V1 — live

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
- Responsive desktop and mobile UI

### V0 prototype — preserved

- Interactive discovery map
- Demo nearby users
- Profile previews and interests
- Local prototype connection/chat behavior
- Responsive desktop and mobile UI

Open with `?demo=1`.

## Backend

Closeby owns only these Project Hub resources:

- `closeby.profiles`
- `closeby.presence`
- `closeby.connections`
- `closeby.messages`
- `closeby.blocks`
- `closeby.reports`

All user-facing Closeby tables have Row Level Security enabled. Anonymous users have no `closeby` schema/table access and cannot execute Closeby application RPCs. Direct browser access is least-privilege: profile self-management, connection/message reads, and report insert/read only; sensitive writes go through authenticated Closeby RPCs.

The Data API has automatic exposure of new tables disabled, and Closeby's schema defaults are additionally hardened so future objects are opt-in.

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

Closeby must not modify another app's schema or shared Project Hub configuration without explicit approval.

## Run locally

```bash
npm install
npm run dev
```

Real Closeby client:

```text
http://localhost:5173/
```

Preserved V0 prototype:

```text
http://localhost:5173/?demo=1
```

Production build:

```bash
npm run build
```

## Roadmap

### V1 — real users
Authentication, onboarding, secure approximate presence, nearby discovery, connection requests, persisted chat, blocks and reports.

### V2 — communication
LiveKit voice/video calls, typing indicators, read receipts, notifications and richer friend presence.

### V3 — discovery
Interest filters, map clustering, city/world zoom, group huddles and contextual discovery.

---

Built as an original social discovery product focused on presence without precise tracking.
