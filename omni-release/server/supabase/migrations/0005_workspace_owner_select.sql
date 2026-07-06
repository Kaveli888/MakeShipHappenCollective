-- Fix: owners must be able to SELECT their workspace immediately after INSERT.
--
-- ensureWorkspace() inserts the workspace first and the workspace_members row
-- second. The original ws_select policy (using is_ws_member(id)) therefore
-- blocks the insert read-back (.select("id")) because no membership row exists
-- yet, surfacing as RLS error 42501 ("new row violates row-level security
-- policy"). Allow the owner to always see their own workspace.

drop policy if exists ws_select on workspaces;
create policy ws_select on workspaces for select
  using (is_ws_member(id) or owner_user_id = auth.uid());
