# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Instead, report it
privately through GitHub:

1. Open the [Security tab](https://github.com/NETO-DEV66/Opanhand-mobile-/security).
2. Click **Report a vulnerability**.
3. Describe the issue, the steps to reproduce it, and the impact you see.

You can expect an acknowledgement within a few days. There is no bug bounty; this
is a volunteer project.

## Scope

This repository packages the OpenHands Agent Canvas web app as an Android APK.
It contains no server-side code of its own.

In scope:

- The Android wrapper: `OpenHands-main/android/`, `OpenHands-main/capacitor.config.ts`
- The build and release pipeline: `.github/workflows/build-android-apk.yml`
- The download tooling and static site: `dl/`, `docs/`

Out of scope:

- The OpenHands Agent Canvas application itself. Report those upstream at
  <https://github.com/OpenHands/OpenHands/security>.
- Your own agent server, its configuration, or its credentials.
- Anything that requires a rooted or physically compromised device.

## What this app does with your data

- The APK talks only to the agent server URL you enter. It ships no default
  backend and no API keys.
- Telemetry is disabled at build time (`VITE_DO_NOT_TRACK=1`), so the PostHog
  client is never initialised and makes no network requests.
- The app stores its configuration in app-private storage. `allowBackup` is off,
  so that storage is not copied into device backups.
- The signing keystore is never committed. It exists only as an encrypted GitHub
  Actions secret and in the maintainer's own offline backup. See
  [SIGNING.md](SIGNING.md).

## Secrets

If you believe a secret has been committed, treat it as compromised: revoke and
rotate it first, then report. GitHub secret scanning and push protection are
enabled on this repository, so most credential patterns are blocked at push time.
