Working dirs: vibe-academy-mobile, vibe-academy-api

Goal: ship a robust mobile app fully connected to the API. Users can browse courses, take lessons, attempt quizzes, watch videos.

Phase 1 — Review (5 agents in parallel):
  Agent 1 (API Surface): Document every API endpoint, auth requirements, request/response shapes. Identify gaps for mobile (anything mobile needs that the API doesn't expose yet).
  Agent 2 (Mobile App State): Audit the current mobile app — what's built, what's stubbed, what's broken, navigation structure, state management approach.
  Agent 3 (Course/Lesson Flow): Map the user journey for taking a course — discovery → enrollment → lesson playback → progress tracking → completion. Identify every screen needed.
  Agent 4 (Quiz Engine): Design the quiz UX for mobile — question types supported, answer submission, scoring, retry logic, progress save.
  Agent 5 (Video Player): Spec the video player — adaptive bitrate, offline download, progress sync to API, playback speed, captions, picture-in-picture if applicable.

Phase 2 — Plan:
  Consolidate into a structured implementation plan:
    - Sprint breakdown (2-week sprints, 3 sprints max for MVP)
    - Per-sprint deliverables, screens, API integrations
    - Dependencies (what blocks what)
    - API gaps to close before mobile can ship
    - Testing strategy (unit, integration, device matrix)

Pause here. Wait for my approval before Phase 3.

Phase 3 — Build (5 agents, sprint-by-sprint):
  Sprint 1 (Foundation): Auth, navigation shell, course list, course detail, API client setup.
  Sprint 2 (Learning): Lesson player, video playback, progress tracking, offline handling.
  Sprint 3 (Quizzes + Polish): Quiz engine, scoring, completion certificates, push notifications, analytics.

Each sprint:
  - Spawn agents per major feature
  - Commit per feature
  - End with a working build + screen recordings
  - Don't start sprint N+1 until N is approved

Hard rules:
  - Real API integration, no mocks past Sprint 1.
  - Test on iOS + Android simulator at minimum each sprint.
  - No new auth scheme — reuse what the web app uses.
  - Type-safe API client. Generate types from API schema if possible.

Done per phase: review delivered → plan delivered → my approval → sprints shipped sequentially with recordings.