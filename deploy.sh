#!/usr/bin/env bash
# Deploy script for bento-crm, invoked over SSH by the GitHub Actions deploy key.
# Fast-forwards the checkout (so compose changes and this script stay in sync),
# pulls the image tag GHCR just pushed, recreates the container, then health-checks
# it. Non-zero exit fails the Actions job (no silent failures).
#
# Environment-agnostic: the same committed script runs unchanged in the prod app
# dir (/srv/bento/apps/crm, checkout on `main`, docker-compose.yml) and in the dev
# app dir (/srv/bento/apps/crm-dev, checkout on `dev`, docker-compose.dev.yml).
# Everything environment-specific is derived at runtime:
#   - APP_DIR        : this script's own location
#   - branch         : whatever the checkout is on, pulled from origin
#   - compose file   : $DEPLOY_COMPOSE_FILE (default docker-compose.yml)
#   - compose project: basename of APP_DIR -- equals Compose's own default, so the
#                      prod stack keeps its existing project/container names
#   - container      : looked up via `docker compose ps -q crm`, never hard-coded
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.yml}"
PROJECT="$(basename "$APP_DIR")"
SERVICE="crm"
HEALTH_PORT=4000
IMAGE_TAG="${1:?usage: deploy.sh <image-tag> (reads GHCR_LOGIN_TOKEN from env)}"

cd "$APP_DIR"

dc() { docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"; }

# Keep the compose file and this script current. --ff-only fails loudly rather
# than clobbering anything edited by hand on the server. The branch is whichever
# one this checkout tracks (main for prod, dev for the dev environment).
#
# bento-crm is a PUBLIC repo, so the pull needs no credentials.
#   - http.version=HTTP/1.1: the box's git 2.43 / curl multiplexes info/refs and
#     git-upload-pack onto one HTTP/2 connection, and GitHub 401s the POST --
#     "could not read Username for 'https://github.com'" on a public repo. Pinning
#     HTTP/1.1 for the transfer avoids it. (Also set globally on the server.)
#   - GIT_TERMINAL_PROMPT=0: fail fast instead of hanging on a username prompt.
#   - cleared credential.helper / github.com extraheader: ignore any stale token
#     cached on the box that would turn an anonymous 200 into a 401.
# Do NOT reuse this pattern if the repo is ever made private.
git_pub() {
  GIT_TERMINAL_PROMPT=0 git \
    -c http.version=HTTP/1.1 \
    -c credential.helper= \
    -c 'http.https://github.com/.extraheader=' \
    "$@"
}
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git_pub fetch --quiet origin "$BRANCH"
git_pub merge --ff-only --quiet "origin/$BRANCH"

if [ -n "${GHCR_LOGIN_TOKEN:-}" ]; then
  echo "$GHCR_LOGIN_TOKEN" | docker login ghcr.io -u "${GHCR_LOGIN_USER:-github-actions}" --password-stdin
fi

export CRM_IMAGE_TAG="$IMAGE_TAG"
dc pull "$SERVICE"
dc up -d "$SERVICE"

CONTAINER="$(dc ps -q "$SERVICE")"
if [ -z "$CONTAINER" ]; then
  echo "ERROR: could not resolve the '$SERVICE' container for project '$PROJECT'" >&2
  dc ps >&2
  exit 1
fi

echo "Waiting for $PROJECT/$SERVICE ($CONTAINER) to become healthy..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" node -e "require('http').get('http://127.0.0.1:${HEALTH_PORT}/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))" 2>/dev/null; then
    echo "$PROJECT/$SERVICE is responding after ${i}s"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 1
done

echo "ERROR: $PROJECT/$SERVICE did not respond within 30s after deploy" >&2
docker logs "$CONTAINER" --tail 50 >&2
exit 1
