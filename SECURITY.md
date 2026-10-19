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

This repository packages **AgentDeck**, a standalone direct-connect AI chat app
for Android, as an APK. It contains no server-side code and no backend of its
own.

In scope:

- The Android wrapper: `agentdeck/android/`, `agentdeck/capacitor.config.ts`
- The app's own web UI: `agentdeck/src/`
- The build and release pipeline: `.github/workflows/build-android-apk.yml`
- The download tooling and static site: `tools/`, `docs/`

Out of scope:

- The AI providers the app talks to (OpenAI, Anthropic, Google, OpenRouter,
  Groq, DeepSeek, Mistral, xAI, Ollama). Report issues to those providers.
- Your API keys, your provider account, or your own Ollama/self-run endpoint.
- Anything that requires a rooted or physically compromised device.

## What this app does with your data

- The app talks only to the model provider you choose. It ships no default
  backend, no default provider credentials and no API keys.
- There is **no telemetry of any kind**. The rewritten UI contains no analytics
  or tracking code, so nothing is reported back to this project or anyone else.
- Your API key, base URL, model choice and conversations are stored on the
  device in the app's private web storage. `allowBackup` is off, so that storage
  is not copied into device backups.
- Your key and messages are sent only to the provider they belong to. Nothing
  passes through a server run by this project, because there is not one.
- The signing keystore is never committed. It exists only as an encrypted GitHub
  Actions secret and in the maintainer's own offline backup. See
  [SIGNING.md](SIGNING.md).

## Secrets

If you believe a secret has been committed, treat it as compromised: revoke and
rotate it first, then report. GitHub secret scanning and push protection are
enabled on this repository, so most credential patterns are blocked at push time.
