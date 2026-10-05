#!/usr/bin/env bash
# LoveDopa blog-image-gen.sh — Generate blog image via Gemini Imagen and upload to Supabase Storage.
# Modified from /opt/jarvisai/scripts/blog-image-gen.sh with LoveDopa brand tokens.
#
# Usage: blog-image-gen.sh <slug> <image_role> "<prompt>"

set -euo pipefail

SLUG="${1:?slug required}"
ROLE="${2:?image_role required}"
PROMPT="${3:?prompt required}"

: "${GOOGLE_API_KEY:?GOOGLE_API_KEY missing}"
: "${VORTEX_SUPABASE_URL:?VORTEX_SUPABASE_URL missing}"
: "${VORTEX_SUPABASE_SERVICE_JWT:?VORTEX_SUPABASE_SERVICE_JWT missing}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

STYLE_SUFFIX=" Warm photorealistic healthcare photography, cinematic natural lighting, soft warm tones, coral (#E8634A) and teal (#2A9D8F) accents, pearl (#E2DFD2) background tones, NEVER indigo, NEVER violet, NEVER purple, professional medical aesthetic, no text, no logos, no watermarks, high resolution, 16:9 aspect."

FULL_PROMPT="${PROMPT}${STYLE_SUFFIX}"

REQ_PAYLOAD=$(python3 -c "
import json
prompt = '''${FULL_PROMPT}'''
print(json.dumps({
  'instances': [{'prompt': prompt}],
  'parameters': {
    'sampleCount': 1,
    'aspectRatio': '16:9',
    'safetyFilterLevel': 'block_few',
    'personGeneration': 'dont_allow'
  }
}))
" 2>/dev/null)

RESPONSE_FILE="$TMPDIR/imagen.json"
HTTP_CODE=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQ_PAYLOAD")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Gemini Imagen returned $HTTP_CODE" >&2
  cat "$RESPONSE_FILE" >&2
  exit 1
fi

B64=$(python3 -c "
import json, sys
d = json.load(open('$RESPONSE_FILE'))
preds = d.get('predictions', [])
if not preds or 'bytesBase64Encoded' not in preds[0]:
  print('ERROR: no image in response', file=sys.stderr)
  sys.exit(2)
print(preds[0]['bytesBase64Encoded'])
")

PNG_FILE="$TMPDIR/$ROLE.png"
echo "$B64" | base64 -d > "$PNG_FILE"

SIZE=$(stat -c %s "$PNG_FILE")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: generated image too small ($SIZE bytes)" >&2
  exit 3
fi

STORAGE_PATH="$SLUG/$ROLE.png"
UPLOAD_URL="$VORTEX_SUPABASE_URL/storage/v1/object/blog-assets/$STORAGE_PATH"

UP_CODE=$(curl -s -o "$TMPDIR/upload.log" -w "%{http_code}" \
  -X POST "$UPLOAD_URL" \
  -H "Authorization: Bearer $VORTEX_SUPABASE_SERVICE_JWT" \
  -H "apikey: $VORTEX_SUPABASE_SERVICE_JWT" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@$PNG_FILE")

if [ "$UP_CODE" != "200" ] && [ "$UP_CODE" != "201" ]; then
  UP_CODE=$(curl -s -o "$TMPDIR/upload.log" -w "%{http_code}" \
    -X PUT "$UPLOAD_URL" \
    -H "Authorization: Bearer $VORTEX_SUPABASE_SERVICE_JWT" \
    -H "apikey: $VORTEX_SUPABASE_SERVICE_JWT" \
    -H "Content-Type: image/png" \
    --data-binary "@$PNG_FILE")
fi

if [ "$UP_CODE" != "200" ] && [ "$UP_CODE" != "201" ]; then
  echo "ERROR: Supabase upload failed ($UP_CODE)" >&2
  cat "$TMPDIR/upload.log" >&2
  exit 4
fi

PUBLIC_URL="$VORTEX_SUPABASE_URL/storage/v1/object/public/blog-assets/$STORAGE_PATH"

python3 -c "
import json
print(json.dumps({'url': '$PUBLIC_URL', 'size': $SIZE, 'role': '$ROLE', 'slug': '$SLUG'}))
"
