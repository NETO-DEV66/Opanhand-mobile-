#!/usr/bin/env bash
# Publish a built APK as a GitHub Release on NETO-DEV66/Opanhand-mobile-.
#
# GitHub Release asset URLs are permanent and public, so this is the durable
# "never goes down" host. It needs a token that can write Releases.
#
# Prefer letting CI publish: push a v* tag and the workflow attaches the signed
# APK. Use this script when you built locally and want to publish by hand.
#
# Usage:
#   GH_PAT=<token-with-repo-scope> bash publish-github.sh v1.27.2
set -u

REPO="NETO-DEV66/Opanhand-mobile-"
TAG="${1:-}"
if [ -z "$TAG" ]; then
  echo "usage: GH_PAT=<token> bash publish-github.sh <tag>   e.g. v1.27.2" >&2
  exit 1
fi
TITLE="OpenHands Mobile $TAG (Android APK)"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APK="$DIR/../OpenHands-main/android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APK" ]; then
  echo "ERROR: no built APK at $APK" >&2
  echo "Build it first: cd OpenHands-main/android && ./gradlew assembleRelease" >&2
  exit 1
fi

TOKEN="${GH_PAT:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: no token. Set GH_PAT (a token with 'repo' scope)." >&2
  exit 1
fi

api() { curl -sS -m 120 -H "Authorization: Bearer $TOKEN" \
        -H "Accept: application/vnd.github+json" "$@"; }

echo "==> checking token write access on $REPO"
LOGIN=$(api https://api.github.com/user | python3 -c "import json,sys;print(json.load(sys.stdin).get('login','?'))")
echo "    token user: $LOGIN"

SHA=$(curl -sS -m 60 -H "Authorization: Bearer $TOKEN" \
      "https://api.github.com/repos/$REPO/commits/main" \
      | python3 -c "import json,sys;print(json.load(sys.stdin)['sha'])")

echo "==> creating release $TAG"
EXISTING=$(api "https://api.github.com/repos/$REPO/releases/tags/$TAG")
if echo "$EXISTING" | grep -q '"id"'; then
  echo "    release $TAG already exists, reusing it"
else
  api -X POST "https://api.github.com/repos/$REPO/releases" \
    -d "$(TAG="$TAG" TITLE="$TITLE" python3 -c '
import json, os
print(json.dumps({
  "tag_name": os.environ["TAG"],
  "name": os.environ["TITLE"],
  "body": (
    "Android build of the OpenHands Agent Canvas UI, packaged with Capacitor 7.\n\n"
    "**Install**\n"
    "1. Uninstall any older OpenHands Mobile build - the app was re-signed.\n"
    "2. Allow install from unknown sources for your browser / file manager.\n"
    "3. Open the APK on the phone and install it.\n"
    "4. On first launch, add your agent server host and API key.\n\n"
    "This release was produced by an AI agent (OpenHands) on behalf of the "
    "repository owner."
  ),
}))')" > /dev/null
  echo "    created"
fi

echo "==> uploading app-release.apk"
REL_ID=$(api "https://api.github.com/repos/$REPO/releases/tags/$TAG" \
         | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
# Replace an existing asset of the same name, if there is one.
ASSET_ID=$(api "https://api.github.com/repos/$REPO/releases/$REL_ID/assets" \
           | python3 -c 'import json,sys;print(next((a["id"] for a in json.load(sys.stdin) if a["name"]=="app-release.apk"), ""))')
if [ -n "$ASSET_ID" ]; then
  api -X DELETE "https://api.github.com/repos/$REPO/releases/assets/$ASSET_ID" > /dev/null
  echo "    removed previous asset"
fi
api -X POST \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=app-release.apk" \
  > /dev/null

echo
echo "Permanent download links:"
echo "  https://github.com/$REPO/releases/latest"
echo "  https://github.com/$REPO/releases/download/$TAG/app-release.apk"
