-- Closeby App #11 — advisor follow-up indexes
create index if not exists messages_sender_idx on closeby.messages(sender_id);
create index if not exists reports_reported_idx on closeby.reports(reported_id);
