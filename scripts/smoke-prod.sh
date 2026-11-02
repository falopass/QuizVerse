#!/usr/bin/env bash
# smoke-prod.sh — chequeo HTTP contra la web desplegada (producción por defecto).
#
# Uso:
#   scripts/smoke-prod.sh [base-url]
#   SMOKE_BASE_URL=https://preview.example scripts/smoke-prod.sh
#
# Sale con código != 0 si alguna comprobación falla. Sin dependencias: bash+curl.

set -u

BASE_URL="${1:-${SMOKE_BASE_URL:-https://quizverse.org}}"
BASE_URL="${BASE_URL%/}"
CURL_TIMEOUT=25
GOOGLEBOT_UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

failures=0

# check_status <path> <status esperado> [User-Agent]
check_status() {
  local path="$1" expected="$2" ua="${3:-}"
  local code
  code=$(curl -sS -o /dev/null -m "$CURL_TIMEOUT" -w '%{http_code}' \
    ${ua:+-A "$ua"} "$BASE_URL$path" 2>/dev/null) || code="000"
  if [ "$code" = "$expected" ]; then
    printf '  ok   %s %s\n' "$code" "$path"
  else
    printf '  FAIL %s (esperado %s) %s\n' "$code" "$expected" "$path"
    failures=$((failures + 1))
  fi
}

# check_absent <path> <string que NO debe aparecer en el body>
check_absent() {
  local path="$1" needle="$2"
  local body
  body=$(curl -sS -m "$CURL_TIMEOUT" "$BASE_URL$path" 2>/dev/null) || body=""
  if printf '%s' "$body" | grep -qF "$needle"; then
    printf '  FAIL %s contiene "%s"\n' "$path" "$needle"
    failures=$((failures + 1))
  else
    printf '  ok   %s sin "%s"\n' "$path" "$needle"
  fi
}

echo "Smoke contra $BASE_URL"
echo

echo "Portadas y catálogo"
check_status /en 200
check_status /es 200
check_status /en/quiz 200
check_status /es/quiz 200

echo "Ficha de quiz y flujo de juego"
check_status /en/quiz/en-salvador-dali-trivia 200
check_status /es/quiz/es-trivia-salvador-dali 200
check_status /en/quiz/en-salvador-dali-trivia/play 200
check_status /en/quiz/en-salvador-dali-trivia/result 200

echo "Imágenes OG"
check_status /en/quiz/en-salvador-dali-trivia/opengraph-image 200
check_status /api/og/result/en/en-salvador-dali-trivia 200

echo "Otras páginas"
check_status /en/category/trivia 200
check_status /en/leaderboard 200
check_status /en/login 200
check_status /en/register 200

echo "Archivos de sitio"
check_status /sitemap.xml 200
check_status /robots.txt 200
check_status /favicon.ico 200
check_status /en/feed.xml 200

echo "Redirects"
check_status / 307
check_status /feed.xml 308
check_status /en/explore 308
check_status /opengraph-image 308
check_status /es/quiz/en-star-wars-fan-trivia-challenge 308

echo "404 reales (incluido Googlebot)"
check_status /en/quiz/no-existe-xyz 404
check_status /en/quiz/no-existe-xyz 404 "$GOOGLEBOT_UA"
check_status /en/category/nope 404
check_status /en/no-such-page 404

echo "Seguridad de la clave de respuestas"
check_absent /en/quiz/en-salvador-dali-trivia/play is_correct

echo
if [ "$failures" -gt 0 ]; then
  echo "SMOKE FAIL: $failures comprobación(es) fallida(s) en $BASE_URL"
  exit 1
fi
echo "SMOKE OK: todas las comprobaciones pasaron en $BASE_URL"
