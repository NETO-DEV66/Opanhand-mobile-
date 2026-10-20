# Publishing this repo on a fresh GitHub account

This repository builds a signed Android APK in GitHub Actions. Follow these
steps in order. Steps 1–3 are needed before the first build will publish
anything; the rest are one-time settings.

## 1. Push the repository

Create an empty repository on the new account (do **not** initialise it with a
README), then:

```bash
cd openhands-mobile
git remote set-url origin https://github.com/<NEW_USER>/<NEW_REPO>.git
git push -u origin main
```

Nothing in the repo is tied to an old account name, so no edits are required to
push. The placeholder `NETO-DEV66` appears in the README, the landing page
and the publish scripts. Replace it when you are ready to point those at the new
account:

```bash
grep -rl NETO-DEV66 --exclude-dir=.git . \
  | xargs sed -i 's/NETO-DEV66/<NEW_USER>/g'
```

Substitute your actual username for `<NEW_USER>` in both commands above.

## 2. Create a signing keystore

One keystore, kept forever. Losing it means every user must uninstall before
they can update, so back it up outside the repository.

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias openhands \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12 \
  -dname "CN=OpenHands Mobile, OU=Agent Canvas, O=OpenHands, C=IN"
```

Base64 it for the Actions secret:

```bash
base64 -w0 release.keystore > keystore.b64   # macOS: base64 -i release.keystore
```

## 3. Add the repository secrets

Settings → Secrets and variables → Actions → **Secrets**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | contents of `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the store password you chose |
| `ANDROID_KEY_PASSWORD` | the key password (usually the same) |
| `ANDROID_KEY_ALIAS` | `openhands` |

Without `ANDROID_KEYSTORE_BASE64` the workflow still builds, but the APK is
unsigned and is deliberately **not** published.

Optional **Variables** tab:

| Variable | Value |
| --- | --- |
| `BACKEND_BASE_URL` | the agent server the phone should talk to; leave unset to let the user type it on first launch |
| `SIGNING_CERT_SHA256` | set after the first release (see step 5) |

## 4. Run the build

Actions → **Build Android APK** → *Run workflow*, or push a tag:

```bash
git tag v1.29.0 && git push origin v1.29.0
```

A tag push creates a GitHub Release and attaches `app-release.apk`. That asset
URL is permanent and public:

```
https://github.com/<NEW_USER>/<NEW_REPO>/releases/latest/download/app-release.apk
```

## 5. Pin the signing certificate

Read the fingerprint from the APK the build produced:

```bash
apksigner verify --print-certs app-release.apk | grep SHA-256
```

Put that value in the `SIGNING_CERT_SHA256` repository variable. From then on
the workflow refuses to publish an APK signed with any other key, which is what
keeps in-place updates working. Also paste it into `SIGNING.md`.

## 6. Enable GitHub Pages

Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder
`/docs`. The landing page then serves at
`https://<NEW_USER>.github.io/<NEW_REPO>/`. `docs/.nojekyll` is already present
so the `assets/` folder is served.

## 7. Hashes

The signer fingerprint is fixed and already recorded in `SIGNING.md`,
`README.md` and `docs/index.html`:

```
0B:05:77:B8:11:BD:3D:0E:6D:6E:F5:DA:39:07:D9:4B:91:C0:50:E6:DF:F9:7C:E1:36:0F:F5:31:40:A3:FF:47
```

The APK's own size, MD5 and SHA-256 change with every build, so they are not
hard-coded anywhere: the workflow prints them (`sha256sum`) and GitHub shows
them on each release page. Nothing has to be filled in by hand after a release.

## Keeping the account healthy

- Do not commit keystores, tokens or `.env` files. `.gitignore` already excludes
  `*.keystore`, `*.jks` and `.openhands/`.
- Push at a human pace on a new account. A burst of commits that mirrors another
  project is what spam heuristics look for.
- Enable two-factor authentication.
- The Android `applicationId` is `dev.openhandsmobile.com`, deliberately
  distinct from the upstream project so the two can never be confused. It is set
  in `OpenHands-main/android/app/build.gradle`,
  `OpenHands-main/capacitor.config.ts` and
  `OpenHands-main/android/app/src/main/res/values/strings.xml`. Changing it
  later breaks in-place updates, so treat it as fixed.
