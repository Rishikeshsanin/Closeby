# Project Hub Agent Boundary

This repository uses a shared Supabase **Project Hub**.

Application: `Closeby`
Assigned app slug/schema: `closeby`

## Mandatory before any Supabase write

1. Read `SUPABASE_HUB_RULES.md`.
2. Read `hub.read_me_first`.
3. Verify this app in `hub.apps`.
4. Run:

```sql
select hub.assert_app_scope('closeby', 'closeby');
```

If any check fails, stop.

## Allowed boundary

```text
closeby.*
```

plus explicitly registered `closeby`-prefixed resources.

## Protected

```text
hub.*
public.*
auth.*
storage.*
realtime.*
every other application schema
project-wide configuration
```

Never:
- modify another app
- create ordinary Closeby tables in `public`
- run unscoped destructive SQL
- disable RLS as a shortcut
- expose or commit project-level secret/service-role credentials
- change project-wide settings without explicit user approval
- create cross-app foreign keys or dependencies
- store or expose another user's exact GPS coordinates to browser clients

Closeby must use privacy-preserving approximate location for discovery. Exact device coordinates, when supplied, may only be used transiently to derive coarse discovery data and must not be returned to other users.

When a requested change could affect another project/app or shared Project Hub infrastructure, stop and ask the user.
