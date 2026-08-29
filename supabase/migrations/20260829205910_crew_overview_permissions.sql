-- The mission overview RPC is called through the service-role client inside
-- manage-mission. Keep the private membership helper unavailable to public
-- API roles while allowing that trusted server-side caller to resolve it.
grant usage on schema private to service_role;
grant execute on function private.is_active_squad_member(uuid, uuid) to service_role;
