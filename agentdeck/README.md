# AgentDeck web UI

This directory holds the AgentDeck single-page web app that the Android shell
wraps. The UI and the Android shell are **this project's own work**, released
under the MIT license. The app is **not** the OpenHands Agent Canvas and it is
**not** affiliated with or endorsed by All Hands AI. See the repository root
[README](../README.md) for the full credit note.

## How the app works

AgentDeck is a standalone direct-connect chat client. There is no backend and no
server of any kind:

- On first launch the user picks a provider (OpenAI, Anthropic, Google Gemini,
  OpenRouter, Groq, DeepSeek, Mistral, xAI Grok, Ollama or a custom
  OpenAI-compatible endpoint) and pastes an API key. Ollama and the custom
  endpoint also take a base URL instead of a key.
- The key, base URL, model choice and conversations are stored on the device in
  the app's web storage.
- Requests go straight from the device to the provider the user chose. Nothing
  is proxied through a server run by this project, because there is not one.
- There is no telemetry or analytics code.

The source lives under `src/`:

- `src/agentdeck/` - providers, LLM calls, chat state and local storage
- `src/agentdeck/components/` - chat UI, composer, message list, provider setup,
  settings sheet
- `src/routes/` - `chat.tsx`, `connection-settings.tsx`, `not-found.tsx`

## Build

```sh
npm ci
npm run build:app      # emits ./build
npx cap sync android   # copies the bundle into the Android project
```

The Android project itself lives in `android/` (see the repository root README).

## Checks

```sh
npm run typecheck      # the check that matters
```

The Vitest suite inherited from the pre-rewrite code base is not maintained in
this fork; `npm run typecheck` is the check that counts.
