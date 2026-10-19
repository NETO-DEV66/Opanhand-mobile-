<div align="center">

# AgentDeck

**A standalone Android app for chatting with your favourite AI models.**

Pick a provider, paste your API key, and start chatting — no server to run.

> **Independent project.** AgentDeck is not affiliated with or endorsed by All
> Hands AI or the OpenHands project. The Android shell and the web UI are this
> project's own work, released under the MIT license. There is no backend to run
> and nothing to sign in to: the app talks directly to the model provider you
> choose. See [Credits and license](#credits-and-license).

[![AgentDeck — AI chat on Android](docs/promo/banner-wide-1600x900.png)](https://neto-dev66.github.io/Opanhand-mobile-/)

[![Download APK](https://img.shields.io/badge/Download-APK-6c5ce7?style=for-the-badge&logo=android&logoColor=white)](https://github.com/NETO-DEV66/Opanhand-mobile-/releases/latest/download/app-release.apk)
[![Website](https://img.shields.io/badge/Website-agentdeck-FF6A3D?style=for-the-badge&logo=githubpages&logoColor=white)](https://neto-dev66.github.io/Opanhand-mobile-/)
[![Version](https://img.shields.io/badge/version-1.29.0-blue?style=for-the-badge)](https://github.com/NETO-DEV66/Opanhand-mobile-/releases/tag/v1.29.0)
[![Build](https://github.com/NETO-DEV66/Opanhand-mobile-/actions/workflows/build-android-apk.yml/badge.svg)](https://github.com/NETO-DEV66/Opanhand-mobile-/actions/workflows/build-android-apk.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](https://github.com/NETO-DEV66/Opanhand-mobile-/blob/main/LICENSE)
[![Support via UPI](https://img.shields.io/badge/Support-UPI-ff9f1c?style=for-the-badge&logo=buymeacoffee&logoColor=white)](#support-this-project)

</div>

---

## Download

**The download link below never changes.** It always serves the newest release.

| Build | Size | Link |
| --- | --- | --- |
| **Universal (signed)** | 5.7 MB | **[app-release.apk](https://github.com/NETO-DEV66/Opanhand-mobile-/releases/latest/download/app-release.apk)** |

All builds: [Releases page](https://github.com/NETO-DEV66/Opanhand-mobile-/releases)

The release is a **single universal APK** — one file that installs on every
device (arm64, armv7 and x86_64). The web bundle contains no native code, so
there is nothing to split per architecture, and there is no separate debug
build to choose between. One download works for everyone.

> **Updating from v1.28.x or earlier?** Uninstall that build first. v1.29.0
> completes the rebrand: the package id is now `dev.netodev66.agentdeck`
> (previously `dev.netodev66.openhandsmobile`), so Android treats it as a new
> app and the old copy must go. The signing key itself has not changed, so from
> v1.29.0 onward every release installs straight over the previous one — no
> uninstall, no lost settings. See [SIGNING.md](SIGNING.md) for the fingerprint.

There is also a landing page with install steps and checksums:
**<https://neto-dev66.github.io/Opanhand-mobile-/>**

### Get automatic updates with Obtainium

This app is not on the Play Store. To get notified about new versions, add it to
[Obtainium](https://github.com/ImranR98/Obtainium) — a free, open-source app that
installs and updates apps straight from their GitHub releases.

[![Get it on Obtainium](docs/assets/badge_obtainium.png)](https://apps.obtainium.imranr.dev/redirect?r=obtainium%3A%2F%2Fapp%2F%7B%22id%22%3A%22dev.netodev66.agentdeck%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FNETO-DEV66%2FOpanhand-mobile-%22%2C%22author%22%3A%22NETO-DEV66%22%2C%22name%22%3A%22AgentDeck%22%7D)

Tap the badge on your phone and Obtainium fills in the details for you. Or add
this URL by hand:

```
https://github.com/NETO-DEV66/Opanhand-mobile-
```

### Verify your download

The release APK is signed with a key that never changes. The signer fingerprint
is therefore the same for every release:

```
File:    app-release.apk
Package: dev.netodev66.agentdeck
Signer:  SHA-256 0B:05:77:B8:11:BD:3D:0E:6D:6E:F5:DA:39:07:D9:4B:91:C0:50:E6:DF:F9:7C:E1:36:0F:F5:31:40:A3:FF:47
```

The file's own size and hashes change with every build, so the release workflow
prints them and puts them in the notes on the
[releases page](https://github.com/NETO-DEV66/Opanhand-mobile-/releases) for
each version. Compare what you downloaded against that version's numbers:

```
Size:    <printed in the release notes>
MD5:     <printed in the release notes>
SHA-256: <printed in the release notes>
```

Check it on your phone or PC:

```bash
sha256sum app-release.apk                  # Linux / macOS
certutil -hashfile app-release.apk SHA256  # Windows
```

To confirm the APK really came from this project, compare the signing
certificate above — `apksigner verify --print-certs app-release.apk`.

---

## What is AgentDeck?

AgentDeck is a standalone Android app for chatting with AI models. On first
launch you pick a provider, paste an API key, and you are chatting. There is no
account to create, no server to run, and no sign-in of any kind.

The app talks **directly to the provider you choose** — OpenAI, Anthropic,
Google Gemini, OpenRouter, Groq, DeepSeek, Mistral, xAI Grok, Ollama, or any
OpenAI-compatible endpoint. Your API key is stored on the device and sent only
to that provider; nothing passes through a middleman.

The web UI and the Android shell are this project's own work, built with
[Capacitor](https://capacitorjs.com/) and a React Router 7 single-page app. The
app is **not** the OpenHands Agent Canvas, and it is **not** affiliated with or
endorsed by All Hands AI. See [Credits and license](#credits-and-license).

### Chat with any model, straight from your phone

There is no desktop prerequisite. The app needs one thing: a network path to a
model provider, and an API key for a hosted one. Local models work too — point
Ollama at a machine on your network and the phone becomes the client.

If you searched for a **"ChatGPT Android app"**, an **"AI chat APK"**, or a way
to **"use an API key on your phone"** without a laptop in the loop — this is
that.

| Question | Answer |
| --- | --- |
| Do I need to run a server? | No. The app connects straight to the provider's API. |
| Do I need an account? | No account with this project. You do need an API key from your chosen provider. |
| Do I need a Play Store account? | No. You sideload the APK. |
| Is it free? | Yes — MIT licensed, no telemetry. You pay the provider for usage, if anything. |
| Which Android versions? | 6.0 (Marshmallow, API 23) and newer. |

---

## Requirements

| Item | Value |
| --- | --- |
| Android version | 6.0 (Marshmallow, API 23) or newer |
| Architecture | Universal — arm64, armv7, x86_64 (no native code) |
| Permissions | Internet only |
| API key | One from any supported provider: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, Mistral or xAI Grok. Ollama and the Custom (OpenAI-compatible) entry need no key. |
| Telemetry | None. The app contains no analytics code at all. |

The app needs network access to the provider you choose. It does **not** bundle
a backend and it does **not** proxy your requests: your key and your messages go
straight from the device to the provider.

---

## Install

> **Updating from v1.28.x or earlier?** Uninstall that build once. v1.29.0
> changed the package id to `dev.netodev66.agentdeck`, so Android sees it as a
> new app. The signing key is unchanged, so from v1.29.0 onward every release
> installs straight over the previous one — no uninstall, no lost settings. See
> [SIGNING.md](SIGNING.md) for the fingerprint.

1. On your phone, open the [download link](https://github.com/NETO-DEV66/Opanhand-mobile-/releases/latest/download/app-release.apk).
2. If Android asks, allow **install from unknown sources** for your browser or
   file manager. (Settings → Apps → Special access → Install unknown apps.)
3. Open the downloaded APK and tap **Install**.
4. You may see a Play Protect warning because the app is not distributed through
   the Play Store. Tap **Install anyway**.
5. Launch **AgentDeck** from your app drawer.

---

## First launch

There is nothing to configure on a server. On first launch the app asks for two
things and then drops you into a conversation:

1. **Pick a provider** — OpenAI, Anthropic, Google Gemini, OpenRouter, Groq,
   DeepSeek, Mistral, xAI Grok, Ollama, or Custom for any OpenAI-compatible
   endpoint. Each entry shows the models it knows about.
2. **Paste your API key** — for a hosted provider, paste a key from your
   account. Ollama and Custom need no key; both show an editable base URL field
   instead (Ollama defaults to `http://localhost:11434/v1`).

Then start chatting. A sensible default model is pre-selected for each provider,
and you can change the provider, model, key or base URL later from **Settings**
inside the app.

Your key, base URL, model choice and conversations are stored on the device. The
app sends your key only to the provider it belongs to.

> Ollama runs on a computer, not on the phone. On Android, `localhost` is the
> phone itself — set the base URL to the LAN address of the machine running
> Ollama (for example `http://192.168.1.10:11434/v1`) and make sure that machine
> is reachable.

---

## Features

What the app actually does today:

- **Streaming chat** — replies appear token by token, and you can stop a
  response while it is still arriving.
- **Saved conversations** — every chat is kept on the device. Start a new one,
  reopen an earlier one, rename it or delete it.
- **Ten providers, one app** — OpenAI, Anthropic, Google Gemini, OpenRouter,
  Groq, DeepSeek, Mistral, xAI Grok, Ollama and any OpenAI-compatible endpoint.
- **Switch provider, model and key in Settings** — change any of it at any time,
  or disconnect entirely and clear the stored key.
- **Your key stays on the device** — it is held in local storage and sent only to
  the provider you selected.
- **Local models** — point Ollama (or a Custom OpenAI-compatible server) at a
  machine on your network and chat with it from the phone.
- **No telemetry** — no analytics, no tracking, no phone-home.

---

## Building from source

You need Node.js 24+, JDK 21, and the Android SDK.

```bash
# 1. Get the code
git clone https://github.com/NETO-DEV66/Opanhand-mobile-.git
cd Opanhand-mobile-/agentdeck

# 2. Install dependencies
npm ci

# 3. Build the web bundle
npm run build:app

# 4. Copy the web bundle into the Android project
npx cap sync android

# 5. Build the APK
cd android
./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`.

There is no server URL to bake in — the app asks the user for a provider and key
on first launch, and stores them on the device.

### Running the tests

The test suite is **not maintained in this fork**. The UI was rewritten for
direct-connect mode, the old mocks and fixtures were removed with it, and no
replacement suite was written, so `npm test` is not a meaningful check here.

The check that matters is the type checker:

```bash
npm run typecheck
```

Linting is available too:

```bash
npm run lint
```

### Signing

The signing keystore is **not** in the repository. It lives only as an
encrypted GitHub Actions secret, so the private key is never public.

The key is pinned: the release workflow compares the APK's signer against a
recorded fingerprint and **refuses to publish if it ever changes**, so users
always get an in-place update. Full detail, including the fingerprint and the
backup and rotation rules, is in [SIGNING.md](SIGNING.md).

Generate a keystore once, and keep the file backed up somewhere safe — if you
lose it you can no longer publish updates that install over the existing app:

```bash
keytool -genkey -v -keystore release.keystore -alias openhands \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then add four repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | the store password you chose |
| `ANDROID_KEY_PASSWORD` | the key password you chose |
| `ANDROID_KEY_ALIAS` | the alias stored in the keystore, e.g. `openhands` |

CI writes `release.keystore` from the secret, signs, and verifies the result.
A local build reads the same names from the environment:

```bash
export AGENTDECK_KEYSTORE_PASSWORD=...
export AGENTDECK_KEY_PASSWORD=...
export AGENTDECK_KEY_ALIAS=openhands
# drop release.keystore at agentdeck/android/app/release.keystore
```

Never commit the keystore. `.gitignore` already excludes `*.keystore` and `*.jks`.

#### Keystore backup and recovery

The private key exists in exactly two places: the GitHub Actions secret, and a
local backup you keep yourself. If both are lost, you can never publish an
update that installs over the existing app — users would have to uninstall
first, and Android would treat the new build as a different app.

Keep the backup **outside** this repository and never serve it from a web
directory. A safe backup bundle contains:

| File | Why |
| --- | --- |
| `release.keystore` | the private key itself |
| `release-cert.pem` | the public certificate, for verification |
| `CREDENTIALS.txt` | the alias and the two passwords |
| `CHECKSUMS.txt` | SHA-256 of the keystore, to detect corruption |

Store that bundle in a password manager, an encrypted archive, or offline
media. To check a backup is still valid and matches the published app:

```bash
keytool -list -keystore release.keystore -storetype PKCS12 \
  -storepass "$STORE_PASSWORD" | grep -i privatekeyentry

# fingerprint must match the certificate the published APK was signed with
keytool -printcert -jarfile app-release.apk | grep SHA256
keytool -printcert -file release-cert.pem | grep SHA256
```

To rebuild a lost GitHub secret from a backup:

```bash
base64 -w0 release.keystore   # paste into ANDROID_KEYSTORE_BASE64
```

If the keystore is genuinely gone, generate a new one, bump the version, and
tell users to uninstall the old app before installing the new build.

---

## Continuous integration

The workflow at
[`.github/workflows/build-android-apk.yml`](.github/workflows/build-android-apk.yml)
builds the APK on every push to `main`, and on every version tag it signs the
release APK with the secret key and attaches it to the GitHub Release.

### Cutting a new release

1. Bump `versionCode` and `versionName` in
   `agentdeck/android/app/build.gradle`.
2. Commit, then tag and push:

```bash
git tag v1.29.0
git push origin v1.29.0
```

GitHub Actions builds and publishes the APK. The `releases/latest/download`
links then point at the new version automatically — no documentation to update.
The publish step only runs when the keystore secret is present, so an unsigned
APK can never be released by accident.

### Optional repository settings

| Name | Type | Purpose |
| --- | --- | --- |
| `SIGNING_CERT_SHA256` | Variable | **Set.** The pinned signer fingerprint. The workflow refuses to publish an APK signed with anything else, and fails closed if it cannot read the fingerprint at all. Change it only when rotating the key on purpose. |
| `ANDROID_KEYSTORE_BASE64` | Secret | The signing keystore, base64-encoded. Required to publish. |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | Keystore store password. |
| `ANDROID_KEY_PASSWORD` | Secret | Keystore key password. |
| `ANDROID_KEY_ALIAS` | Secret | Keystore key alias. |

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "App not installed" | You have a copy signed by a different key, or a build from v1.28.x or earlier with the old package id. Uninstall that one, then install this APK. Releases from v1.29.0 onward always install in place. |
| Play Protect blocks install | Tap **Install anyway**; the APK is not from the Play Store. |
| API key rejected (401/403) | The key is wrong, expired, or not enabled for the model you picked. Re-check it in **Settings**, and confirm the key belongs to the provider you selected. |
| "Could not reach the provider" / CORS or network error | The provider refused a direct browser-origin request. Some providers block these; a different network, a VPN, or a provider that permits browser calls (or a Custom base URL you control) usually works. |
| Model not found (404) | The model id is not available on your account, or the provider renamed it. Choose a different model in **Settings**. |
| Ollama does nothing | Ollama is not running, or the base URL points at the phone. On Android, `localhost` is the phone itself — use the LAN address of the machine running Ollama, e.g. `http://192.168.1.10:11434/v1`, and check that machine allows the connection. |
| Blank screen after an update | Clear app data in Android settings and set the provider up again. |

---

## Support this project

This app is **free and open source**, and it always will be. You do not have to
pay anything to download it, use it, or modify it.

That said, if this project saved you some time and you feel like saying thanks,
a small contribution is genuinely appreciated. It goes towards keeping the build
pipeline running and putting more time into improvements.

### Pay via UPI (India)

| | |
| --- | --- |
| **UPI ID** | `mrsameer1906@okhdfcbank` |
| **Name** | Sameer |

Scan the QR code with any UPI app — GPay, PhonePe, Paytm, BHIM, or your bank's
app — and the payment details fill in automatically:

<div align="center">

<img src="assets/upi-qr.png" alt="UPI QR code for mrsameer1906@okhdfcbank" width="240">

</div>

**Or copy this UPI ID** into the "Pay to UPI ID" field of your UPI app:

```
mrsameer1906@okhdfcbank
```

No amount is suggested and nothing is expected. Give only if you want to, and
only what you are comfortable with. Thank you either way.

### Other ways to help (free)

Not everyone can or should send money. These help just as much:

- **Star this repository** so more people can find it.
- **Report a bug** or suggest an improvement in
  [Issues](https://github.com/NETO-DEV66/Opanhand-mobile-/issues).
- **Tell someone** who would find a pocket AI chat client useful.
- **Contribute** a fix or a feature through a pull request.

---

## Credits and license

AgentDeck is an independent project.

- The Android shell, the web UI and the "AgentDeck" name are this project's own
  work, released under the MIT license. There is no OpenHands code in the app.
- AgentDeck is **not** affiliated with, endorsed by, or derived from All Hands AI
  or the [OpenHands](https://github.com/OpenHands/OpenHands) project. The name
  and concept of OpenHands are credited to them, but no part of their app, their
  agent canvas or their artwork ships here.
- Packaged and maintained by **Sameer** ([@NETO-DEV66](https://github.com/NETO-DEV66)).

This project is not affiliated with or endorsed by the OpenHands team or All
Hands AI. If you want the official product, see
<https://github.com/OpenHands/OpenHands>.

---

<div align="center">

**[Download the latest APK](https://github.com/NETO-DEV66/Opanhand-mobile-/releases/latest/download/app-release.apk)**

If it helped you, you can [buy me a chai ☕](#support-this-project) — but only if you want to.

</div>
