#!/usr/bin/env bash
# Build the headless doomgeneric wasm module for the thunk course DOOM finale.
#
# Output (committed to the repo, so CI never needs emscripten): the two files
#   site/static/doom/doom.js    - ES6 module factory (createDoom)
#   site/static/doom/doom.wasm  - the engine
# are served as static assets. Unlike the S-F prototype this build does NOT
# embed the WAD (no --preload-file, so no doom.data): freedoom1.wad ships
# separately under site/static/doom/ and the page fetches it and FS.writeFile()s
# it into MEMFS before dg_init(). That keeps the module + page shell small and
# lets the ~9.8MB WAD load lazily, only when the bench source switch flips to
# DOOM.
#
# REGENERATION: this script is run by hand when the C port changes; the built
# artifacts are committed. Requires emcc on PATH (installed here via
# `brew install emscripten`, v6.0.3). CI builds the site with the committed
# doom.js/doom.wasm and never invokes emscripten.
#
#   bash site/wasm-doom/build.sh
#
# ---------------------------------------------------------------------------
# TOOLCHAIN GOTCHA (shallow-cwd first build)
# ---------------------------------------------------------------------------
# On this host $HOME is /var/home/goolz (symlinked from /home) and brew's
# emscripten lives under /var/home/linuxbrew. Emscripten's STRICT reproducible-
# path logic then emits a broken relative path to its own system-lib sources
# when emcc runs from a deep cwd, failing the FIRST-run system-library build
# (e.g. clang: error: no such file or directory: '../../../../../var/home/.../gl/gl.c').
# This script uses absolute paths for every input/output, so run the first
# (cache-populating) build from a shallow cwd with a scratch cache:
#
#   cd / && EM_CACHE=/tmp/emc1 bash /var/home/goolz/dev/thunk/site/wasm-doom/build.sh
#
# Once the emscripten cache is warm, later builds from any cwd are fast.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DG="$HERE/doomgeneric/doomgeneric"
OUT="$HERE/../static/doom"
mkdir -p "$OUT"

# SDL-free source list (identical to the soso/linuxvt ports), with the stock
# port file swapped for our headless JS-driven doomgeneric_wasm.c.
SRC=(
  dummy am_map doomdef doomstat dstrings d_event d_items d_iwad d_loop d_main
  d_mode d_net f_finale f_wipe g_game hu_lib hu_stuff info i_cdmus i_endoom
  i_joystick i_scale i_sound i_system i_timer memio m_argv m_bbox m_cheat
  m_config m_controls m_fixed m_menu m_misc m_random p_ceilng p_doors p_enemy
  p_floor p_inter p_lights p_map p_maputl p_mobj p_plats p_pspr p_saveg p_setup
  p_sight p_spec p_switch p_telept p_tick p_user r_bsp r_data r_draw r_main
  r_plane r_segs r_sky r_things sha1 sounds statdump st_lib st_stuff s_sound
  tables v_video wi_stuff w_checksum w_file w_main w_wad z_zone w_file_stdc
  i_input i_video doomgeneric doomgeneric_wasm
)

CFILES=()
for s in "${SRC[@]}"; do CFILES+=("$DG/$s.c"); done

# Native 320x200 framebuffer: RESX/RESY == DOOM's internal resolution means
# i_video's fb_scaling collapses to 1, so DG_ScreenBuffer is exactly 320x200.
CFLAGS=(
  -O2
  -DNORMALUNIX -DLINUX -D_DEFAULT_SOURCE
  -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200
  -Wno-implicit-function-declaration
  -I"$DG"
)

EXPORTS='["_dg_init","_dg_tick","_dg_key_down","_dg_key_up","_dg_get_rgba","_dg_get_frame_ptr","_dg_width","_dg_height","_main","_malloc","_free"]'
# FS is added so the page can FS.writeFile("freedoom1.wad", bytes) before
# dg_init(), replacing the --preload-file the prototype used.
RT='["ccall","cwrap","HEAPU8","HEAPU32","FS"]'

emcc "${CFLAGS[@]}" "${CFILES[@]}" \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createDoom \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s ENVIRONMENT=web,worker \
  -s EXPORTED_FUNCTIONS="$EXPORTS" \
  -s EXPORTED_RUNTIME_METHODS="$RT" \
  -s INVOKE_RUN=0 \
  -o "$OUT/doom.js"

echo "=== build done ==="
ls -la "$OUT"/doom.js "$OUT"/doom.wasm
