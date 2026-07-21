#!/usr/bin/env bash
# Lay a recorded voiceover onto the silent narration film.
#
#   ./mux-audio.sh path/to/narration.wav [offset_seconds]
#
# Loudness-normalizes the VO to -16 LUFS (the standard for spoken video), then
# muxes it onto out/thunk-narration.mp4 with the video copied (no re-encode) ->
# out/thunk-final.mp4. Pass a positive offset to push the audio later, negative
# to pull it earlier, if a listen shows it drifting.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WAV="${1:?usage: mux-audio.sh narration.wav [offset_seconds]}"
OFFSET="${2:-0}"
VIDEO="$HERE/out/thunk-narration.mp4"
OUT="$HERE/out/thunk-final.mp4"
TMP="$HERE/out/.vo-norm.wav"

[ -f "$VIDEO" ] || { echo "missing $VIDEO - run: node narrate.mjs" >&2; exit 1; }
[ -f "$WAV" ]   || { echo "no such file: $WAV" >&2; exit 1; }

echo "normalizing $(basename "$WAV") to -16 LUFS..."
ffmpeg -y -loglevel error -i "$WAV" -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -ac 1 "$TMP"

echo "muxing onto the film (audio offset ${OFFSET}s)..."
ffmpeg -y -loglevel error -i "$VIDEO" -itsoffset "$OFFSET" -i "$TMP" \
	-map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$OUT"

rm -f "$TMP"
echo "done -> $OUT"
