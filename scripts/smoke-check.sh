#!/usr/bin/env sh
set -eu

DOMAIN="${1:-${DOMAIN:-}}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: DOMAIN=example.com sh scripts/smoke-check.sh"
  echo "   or: sh scripts/smoke-check.sh example.com"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[FAIL] curl is required"
  exit 1
fi

echo "[INFO] Smoke-check for $DOMAIN"

HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "http://$DOMAIN/")"
if [ "$HTTP_CODE" != "301" ] && [ "$HTTP_CODE" != "308" ]; then
  echo "[FAIL] HTTP redirect check failed: got status $HTTP_CODE (expected 301/308)"
  exit 1
fi
echo "[OK] HTTP redirect status: $HTTP_CODE"

if ! curl -fsS "https://$DOMAIN/" >/dev/null; then
  echo "[FAIL] HTTPS root is not reachable"
  exit 1
fi
echo "[OK] HTTPS root is reachable"

HEALTH_BODY="$(curl -fsS "https://$DOMAIN/api/health")"
if ! printf "%s" "$HEALTH_BODY" | grep -q '"ok":true'; then
  echo "[FAIL] /api/health response is unexpected: $HEALTH_BODY"
  exit 1
fi
echo "[OK] /api/health returned ok=true"

if command -v openssl >/dev/null 2>&1; then
  CERT_END="$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate || true)"
  if [ -n "$CERT_END" ]; then
    echo "[OK] TLS certificate $CERT_END"
  else
    echo "[WARN] Unable to read certificate expiration"
  fi
else
  echo "[WARN] openssl not found; certificate expiration check skipped"
fi

echo "[DONE] Smoke-check passed"
