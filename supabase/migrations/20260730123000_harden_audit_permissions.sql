begin;

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
alter table public.auth_login_attempts enable row level security;
alter table public.auth_login_attempts force row level security;

revoke all on public.audit_log from anon, authenticated;
revoke all on public.auth_login_attempts from anon, authenticated;

drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
before update or delete on public.audit_log
for each row execute function public.audit_reject_event_mutation();

revoke update, delete, truncate on public.audit_log from service_role;
revoke update, delete, truncate on public.auth_login_attempts from service_role;
revoke update, delete, truncate on public.audit_events from service_role;
revoke update, delete, truncate on public.audit_events_archive from service_role;
revoke delete, truncate on public.audit_sessions from service_role;
revoke delete, truncate on public.audit_retention_settings from service_role;

grant select, insert on public.audit_log to service_role;
grant select, insert on public.auth_login_attempts to service_role;
grant select, insert on public.audit_events to service_role;
grant select, insert on public.audit_events_archive to service_role;
grant select, insert, update on public.audit_sessions to service_role;
grant select, update on public.audit_retention_settings to service_role;

commit;

notify pgrst, 'reload schema';
