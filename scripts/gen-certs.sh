#!/usr/bin/env bash
# Generate a locally-trusted HTTPS certificate for `npm run dev`, so the
# Storyblok Visual Editor (which requires https) can load the local preview.
#
# Requires mkcert: https://github.com/FiloSottile/mkcert
#   macOS:  brew install mkcert nss
#   Linux:  see the mkcert README
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certificates"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Install it first:"
  echo "  macOS: brew install mkcert nss"
  echo "  Linux: https://github.com/FiloSottile/mkcert#installation"
  exit 1
fi

mkdir -p "$CERT_DIR"

# Install the local CA into the system trust store (idempotent).
mkcert -install

# Cover localhost + loopback + the dev bind address, plus this machine's
# .local name so you can test from another device on the LAN.
mkcert \
  -key-file "$CERT_DIR/localhost-key.pem" \
  -cert-file "$CERT_DIR/localhost.pem" \
  localhost 127.0.0.1 ::1 0.0.0.0 "$(hostname).local"

echo
echo "Certificates written to certificates/ (gitignored)."
echo "Run: npm run dev   ->   https://localhost:3000"
echo "Point your Storyblok space preview URL at https://localhost:3000/"
