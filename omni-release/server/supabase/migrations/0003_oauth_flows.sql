-- Short-lived OAuth flow store: holds PKCE verifier + CSRF state between
-- oauth-start and oauth-callback. Service-role only (RLS denies all client
-- access). Rows are one-time-use and expire in ~10 minutes.

create table if not exists oauth_flows (
  state         text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  platform      text not null,
  code_verifier text,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_oauth_flows_expiry on oauth_flows(expires_at);

alter table oauth_flows enable row level security;
-- No policies → only the service role (Edge Functions) can touch it.

-- Optional housekeeping: drop expired flows.
create or replace function purge_expired_oauth_flows() returns void as $$
  delete from oauth_flows where expires_at < now();
$$ language sql;
