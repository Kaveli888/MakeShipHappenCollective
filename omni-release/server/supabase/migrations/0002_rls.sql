-- Row-Level Security. Every user-owned table is readable/writable ONLY by
-- members of the owning workspace. The service role (used by Edge Functions /
-- the worker) bypasses RLS, so server-side publishing still works.
--
-- CRITICAL: clients may never read platform_accounts.tokens_enc. We enforce
-- this with column-less policies + a safe view that omits the column; the app
-- should query `platform_accounts_safe`, never the base table.

-- helper: is the current user a member of the workspace?
create or replace function is_ws_member(ws uuid) returns boolean as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$ language sql security definer stable;

alter table workspaces            enable row level security;
alter table workspace_members     enable row level security;
alter table platform_accounts     enable row level security;
alter table campaigns             enable row level security;
alter table media_assets          enable row level security;
alter table posts                 enable row level security;
alter table post_platform_targets enable row level security;
alter table scheduled_jobs        enable row level security;
alter table publish_attempts      enable row level security;
alter table audit_logs            enable row level security;
alter table analytics_snapshots   enable row level security;

-- workspaces: members can see; owner can manage
create policy ws_select on workspaces for select using (is_ws_member(id));
create policy ws_insert on workspaces for insert with check (owner_user_id = auth.uid());
create policy ws_update on workspaces for update using (owner_user_id = auth.uid());

create policy wm_select on workspace_members for select using (is_ws_member(workspace_id));
create policy wm_manage on workspace_members for all
  using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_user_id = auth.uid()));

-- generic membership policy for the workspace-scoped tables
create policy pa_rw on platform_accounts     for all using (is_ws_member(workspace_id)) with check (is_ws_member(workspace_id));
create policy cmp_rw on campaigns            for all using (is_ws_member(workspace_id)) with check (is_ws_member(workspace_id));
create policy med_rw on media_assets         for all using (is_ws_member(workspace_id)) with check (is_ws_member(workspace_id));
create policy post_rw on posts               for all using (is_ws_member(workspace_id)) with check (is_ws_member(workspace_id));
create policy job_rw on scheduled_jobs       for all using (is_ws_member(workspace_id)) with check (is_ws_member(workspace_id));
create policy aud_rw on audit_logs           for select using (is_ws_member(workspace_id));

-- child tables scoped via their parent post's workspace
create policy tgt_rw on post_platform_targets for all using (
  exists (select 1 from posts p where p.id = post_id and is_ws_member(p.workspace_id))
) with check (
  exists (select 1 from posts p where p.id = post_id and is_ws_member(p.workspace_id))
);

create policy att_select on publish_attempts for select using (
  exists (select 1 from post_platform_targets t join posts p on p.id = t.post_id
          where t.id = post_platform_target_id and is_ws_member(p.workspace_id))
);

create policy ana_select on analytics_snapshots for select using (
  exists (select 1 from post_platform_targets t join posts p on p.id = t.post_id
          where t.id = post_platform_target_id and is_ws_member(p.workspace_id))
);

-- Token-safe view: everything on platform_accounts EXCEPT tokens_enc.
-- Clients query this; only the service role touches the base table's tokens.
create or replace view platform_accounts_safe as
  select id, workspace_id, platform, external_account_id, display_name,
         avatar_url, scopes, token_expires_at, status, connected_at, last_refreshed_at
  from platform_accounts;
