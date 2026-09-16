# Closeby

**See who's around. Connect when it feels right.**

Closeby is a map-first social discovery app for staying connected with friends and discovering new people nearby. The product is designed around opt-in presence, approximate location, mutual connection requests, messaging, and eventually voice/video calling.

## Current prototype

- Interactive live discovery map
- Browser geolocation with graceful demo fallback
- Approximate nearby user markers
- Search by people or interests
- Profile previews and interests
- Connection request flow
- Existing connections view
- Local prototype messaging
- Discoverability/privacy toggle
- Responsive desktop and mobile UI
- Persistent prototype state via localStorage

## Privacy principles

Closeby should never expose another user's precise coordinates to clients. The production architecture will store/process location server-side, expose only coarse or intentionally displaced discovery positions, support invisible mode, and remove blocked users from each other's discovery results.

## Stack

- React
- Vite
- Leaflet / React Leaflet
- Lucide icons
- Carto / OpenStreetMap-based map tiles

### Planned production stack

- Supabase Auth + PostgreSQL
- PostGIS/geospatial querying
- Supabase Realtime for presence, connections and chat
- Supabase Storage for profile media
- LiveKit for voice/video calling
- Vercel for deployment

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Roadmap

### V0 — interaction prototype
Map, profiles, connection flow, friends, messaging UI and privacy controls.

### V1 — real users
Authentication, profile onboarding, Supabase schema, realtime presence, approximate location queries, connection requests, realtime chat, block/report flows and notifications.

### V2 — communication
LiveKit voice/video calls, typing indicators, read receipts, push notifications and richer friend presence.

### V3 — discovery
Interest filters, map clustering, city/world zoom, group huddles and contextual discovery.

---

Built as an original social discovery product focused on presence without precise tracking.
