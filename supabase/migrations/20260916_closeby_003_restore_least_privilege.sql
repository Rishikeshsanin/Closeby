-- Closeby App #11 only: restore least-privilege grants after Data API dashboard exposure toggles.

revoke all privileges on table closeby.profiles from anon;
revoke all privileges on table closeby.connections from anon;
revoke all privileges on table closeby.messages from anon;
revoke all privileges on table closeby.reports from anon;

revoke insert, update, delete on table closeby.connections from authenticated;
revoke insert, update, delete on table closeby.messages from authenticated;
revoke update, delete on table closeby.reports from authenticated;

grant select, insert, update, delete on table closeby.profiles to authenticated;
grant select on table closeby.connections to authenticated;
grant select on table closeby.messages to authenticated;
grant select, insert on table closeby.reports to authenticated;

revoke execute on function closeby.block_user(uuid) from anon;
revoke execute on function closeby.disconnect(uuid) from anon;
revoke execute on function closeby.discover_nearby(double precision, integer) from anon;
revoke execute on function closeby.mark_conversation_read(uuid) from anon;
revoke execute on function closeby.respond_connection_request(uuid, boolean) from anon;
revoke execute on function closeby.send_connection_request(uuid) from anon;
revoke execute on function closeby.send_message(uuid, text) from anon;
revoke execute on function closeby.set_offline() from anon;
revoke execute on function closeby.touch_presence(double precision, double precision) from anon;
revoke execute on function closeby.unblock_user(uuid) from anon;

grant execute on function closeby.block_user(uuid) to authenticated;
grant execute on function closeby.disconnect(uuid) to authenticated;
grant execute on function closeby.discover_nearby(double precision, integer) to authenticated;
grant execute on function closeby.mark_conversation_read(uuid) to authenticated;
grant execute on function closeby.respond_connection_request(uuid, boolean) to authenticated;
grant execute on function closeby.send_connection_request(uuid) to authenticated;
grant execute on function closeby.send_message(uuid, text) to authenticated;
grant execute on function closeby.set_offline() to authenticated;
grant execute on function closeby.touch_presence(double precision, double precision) to authenticated;
grant execute on function closeby.unblock_user(uuid) to authenticated;

alter default privileges for role postgres in schema closeby
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema closeby
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema closeby
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema closeby
  revoke execute on functions from public;
