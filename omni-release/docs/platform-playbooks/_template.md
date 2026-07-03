# Platform Name

Status: training pending.

## Scope

Describe exactly which platform surface this playbook covers.

Examples:

- profile post
- Page post
- group post
- video upload
- story
- reel
- short

## Entry

- URL:
- Required account/profile/page:
- Visual identity signal:
- Preferred opening path:

## Card Routing

Use this flow when:

```json
{
  "platform": "",
  "options": {}
}
```

## Composer

Visible page signals:

-

Flow:

1.
2.
3.

## Media Rules

- Supported media:
- Unsupported media:
- Aspect ratio limits:
- File size limits:
- Multi-file behavior:
- Thumbnail behavior:
- Platform-safe derivative rule:

## Success Signal

Record the exact visible proof:

-

After this is visible, write:

```json
{
  "platform": "",
  "outcome": "posted",
  "external_url": ""
}
```

Also capture screenshot proof to `outbox/done/<job_id>.png`.

## Known Gates

- logged out:
- 2FA:
- CAPTCHA:
- wrong account/page:
- media rejected:
- platform UI changed:

## Notes From Training

Date:
Trainer:
Job/example:
Observed quirks:
