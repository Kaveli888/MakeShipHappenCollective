-- The platform_accounts CHECK constraint (0001_schema.sql) predates the LinkedIn
-- integration and omits 'linkedin', so the oauth-callback upsert of a connected
-- LinkedIn account is rejected by the database. Widen the allowed-platform list.
alter table platform_accounts
  drop constraint if exists platform_accounts_platform_check;

alter table platform_accounts
  add constraint platform_accounts_platform_check
  check (platform in ('youtube','tiktok','instagram','facebook','x','twitch','linkedin'));
