# Agent Canvas (vendored source)

This directory holds the Agent Canvas web frontend that the Android app wraps.

It is **third-party source, not our code**. It was copied from the upstream
project so the APK can be built offline:

- Upstream: <https://github.com/OpenHands/OpenHands> (package `@openhands/agent-canvas`)
- License: MIT - see `LICENSE` in this directory. Copyright (c) the OpenHands contributors.

## What was removed from the copy

To keep this repository focused on the Android wrapper, the following
upstream-only material was deleted:

- `.github/`, `.agents/`, `.openhands/` - upstream CI, agent skills and dev hooks
- `__tests__/`, `tests/`, `__mocks__/`, playwright configs, `stryker.config.mjs`
- `docs/`, `examples/`, `helm/`, `specs/`, `docker/`, `electron/`
- `AGENTS.md`, `CHANGELOG.md`, `README.windows.md`
- signing material and the `husky` prepare hook

None of it is needed to produce the web bundle or the APK.

## Build

```sh
npm ci
npm run build:app      # emits ./build
npx cap sync android   # copies the bundle into the Android project
```

The Android project itself lives in `android/` (see the repository root README).

## Upstream project

Agent Canvas is part of OpenHands, an open-source platform for AI coding
agents. For the real documentation, issue tracker and support, use the upstream
repository - this copy is only a build input and is not maintained here.
