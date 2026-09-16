# Supabase Project Hub Rules — Closeby

App slug/schema: `closeby`

Closeby shares a Supabase project with independent applications.

## Core boundary

Closeby may normally modify only:

```text
closeby.*
```

It must not modify another application's objects.

## Mandatory first checks

```sql
select * from hub.read_me_first;

select
  app_number,
  slug,
  display_name,
  schema_name,
  status,
  safety_contract_version,
  safety_contract_acknowledged_at
from hub.apps
where slug = 'closeby';

select hub.assert_app_scope('closeby', 'closeby');
```

If any check fails: STOP.

## Database rules

- use fully-qualified names
- one app = one schema
- never create Closeby application tables in `public`
- enable and test RLS on every user-facing table
- do not create cross-app foreign keys or dependencies
- keep migrations Closeby-scoped and app-prefixed where relevant
- store only the minimum location data required for discovery
- never expose exact GPS coordinates of another user
- connection/message reads must be membership-scoped
- block relationships must override discovery, connection and messaging access

## Authentication

Closeby uses Supabase Auth for user identity, but must not modify `auth.users` directly and must not change Project Hub-wide Auth/OAuth configuration without explicit user approval.

Closeby application profile rows live only in `closeby.*`. Authorization must rely on `auth.uid()`/trusted JWT identity, never editable user metadata.

## Location privacy

Closeby is a location-aware social app. Privacy is mandatory:

- browser clients must never receive another user's raw/exact GPS location
- precise coordinates must not be persisted in user-facing tables
- discovery data must be deliberately coarse/approximate
- blocked or invisible users must never appear in discovery results
- visibility and discoverability are opt-in user controls

## Storage

If profile media is added, use only explicitly registered `closeby-` prefixed buckets. Do not create or modify unrelated buckets.

## Functions

Use Closeby-prefixed Edge Function names such as:

```text
closeby-api
closeby-call-token
```

Database functions must live inside `closeby` unless an explicitly approved, registered Hub integration requires otherwise.

## Secrets

Never expose or commit:
- service-role key
- secret key
- database password
- project-level privileged credentials

The frontend may use only the Project Hub Supabase URL plus a publishable/anon key. Any privileged backend access must be least-privilege and Closeby-scoped; do not give an ordinary Closeby backend the project-wide service-role key.

## High-risk operations

Ask the user before:
- project-wide Data API exposed-schema changes
- project-wide Auth/OAuth changes
- key rotation
- extensions
- billing/compute/region changes
- project pause/delete
- cross-app operations

## Destructive operations

Before DROP/DELETE/TRUNCATE:
- verify the exact schema/object
- verify it belongs to `closeby`
- verify data-loss impact
- verify no cross-app dependency

If uncertain: STOP.
