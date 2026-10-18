# Signing

The app is signed with one key, and that key must never change. Android treats
two APKs signed with different keys as two different apps: an update signed with
a new key is refused, and the user has to uninstall first, losing their settings.
Pinning the key is what makes "download and update" work forever.

## The signing certificate

Every published build is signed with the same key. Read the fingerprint off any
APK you downloaded and record it here:

```bash
apksigner verify --print-certs app-release.apk | grep SHA-256
keytool -printcert -jarfile app-release.apk | grep SHA256
```

```
subject : CN=OpenHands Mobile, OU=Agent Canvas, O=OpenHands, C=IN
issuer  : CN=OpenHands Mobile, OU=Agent Canvas, O=OpenHands, C=IN (self-signed)
SHA-256 : 0B:05:77:B8:11:BD:3D:0E:6D:6E:F5:DA:39:07:D9:4B:91:C0:50:E6:DF:F9:7C:E1:36:0F:F5:31:40:A3:FF:47
SHA-1   : 22:9F:42:E0:9C:93:B3:AE:91:8D:DC:78:0E:71:82:4C:CB:49:D1:D8
```

This is a self-signed certificate. It is **not** a Play Store upload key and it
is not trusted by a certificate authority, which is expected for an app that is
installed by sideloading.

The fingerprint is public — it is inside every copy of the APK — so it is safe
to keep in this repository. The **private key** is not, and must never be
committed.

## How it is enforced

Set the `SIGNING_CERT_SHA256` repository variable
(Settings → Secrets and variables → Actions → Variables) to the fingerprint
above. After building, the release workflow in
[`.github/workflows/build-android-apk.yml`](.github/workflows/build-android-apk.yml)
reads the signer from the APK and compares:

- match → the fingerprint is printed and the release is published;
- mismatch → `::error::SIGNING KEY CHANGED`, exit 1, **nothing is published**.

While the variable is unset the check is skipped with a warning, so a first
build with a brand-new keystore can publish. Set the variable on the first
signed release to start enforcing it. It fails closed once set: if the
fingerprint cannot be read from the APK at all, the build stops rather than
publishing something unverified.

To rotate on purpose, generate a new keystore, set the variable to the new
fingerprint, and update this document. Setting that variable is the only correct
way to rotate; editing the workflow to skip the check defeats the guarantee.

## Where the key lives

The keystore is **not** in this repository. It exists in exactly two places:

1. the `ANDROID_KEYSTORE_BASE64` GitHub Actions secret, which CI decodes at
   build time;
2. a backup that you keep outside the repository.

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_PASSWORD` | key password |
| `ANDROID_KEY_ALIAS` | alias, e.g. `openhands` |

Keep the backup outside this repository and never serve it from a web directory.
A safe bundle holds the keystore, its public certificate (`release-cert.pem`),
the alias and passwords, and a checksum of the keystore. Store it in a password
manager, an encrypted archive, or offline media.

## If the key is lost

A lost key cannot be recovered, and this is the one scenario the pin cannot
protect against. There is no way to sign an update that installs over an
existing copy, so:

1. generate a new keystore and update the secrets;
2. update the fingerprint here and in `SIGNING_CERT_SHA256`;
3. bump `versionName` and `versionCode`;
4. tell users in the release notes that this update needs a one-time uninstall.

Losing the key is the only reason a user should ever have to uninstall. Any
other forced uninstall is a bug in the release process.

## History

- The certificate above is the one future updates will keep using, so users on
  a build signed with it update in place. There is no earlier key in play on
  this repository: it has no published releases yet, so the first release sets
  the fingerprint and nothing has to be uninstalled.

## Local builds

A local build reads the same names from the environment:

```bash
export OPENHANDS_KEYSTORE_PASSWORD=...
export OPENHANDS_KEY_PASSWORD=...
export OPENHANDS_KEY_ALIAS=openhands
# drop the keystore at OpenHands-main/android/app/release.keystore
```

`OpenHands-main/android/app/build.gradle` signs only when the keystore file is
present, and logs a warning otherwise. A local unsigned build is fine for
testing, but it cannot be published and cannot update an installed copy.

`.gitignore` already excludes `*.keystore` and `*.jks`.
