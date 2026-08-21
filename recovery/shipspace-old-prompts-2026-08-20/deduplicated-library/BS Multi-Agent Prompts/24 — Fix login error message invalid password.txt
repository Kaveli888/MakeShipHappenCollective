Bug: logging in with the wrong password returns a raw 401. User-reported. Need a clear, friendly message.

Launch 2 deep-dive agents in parallel:
  Agent 1 (Backend): Trace the login endpoint. Identify where 401 is returned. Decide between (a) returning a structured error payload {code: "invalid_credentials", message: "..."} or (b) keeping 401 but adding a body. Choose the approach that matches existing patterns in the codebase.
  Agent 2 (Frontend): Trace the login form's error handling. Map each possible backend response to a user-facing message. Make sure invalid password specifically shows "Invalid password, please try again."

Hard rules:
  - Do not leak whether the email exists (timing + message must not differ for "no such user" vs "wrong password" — return the same generic message). This is a security requirement, override the user's literal wording if needed.
  - Do not break existing auth flows.
  - Add a test for the new message path.

Deliverables: implementation + test + screenshot of the new error state + note on the email-enumeration decision.

Done = friendly message shown + tests pass + no enumeration leak + screenshot posted.