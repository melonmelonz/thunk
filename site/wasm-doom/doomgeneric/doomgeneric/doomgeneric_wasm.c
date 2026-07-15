// doomgeneric headless wasm port for the thunk course DOOM-endgame prototype.
//
// Unlike the stock doomgeneric_emscripten.c (which drives SDL and uses
// emscripten_set_main_loop), this port is HEADLESS and JS-DRIVEN:
//   * no SDL, no canvas ownership inside wasm
//   * ticking is pumped from JS (requestAnimationFrame -> dg_tick())
//   * each frame is copied to a stable exported RGBA buffer JS can read
//   * keyboard events arrive via exported dg_key_down/dg_key_up feeding a
//     small ring buffer that DG_GetKey drains
//
// This shape matches the eventual site transport: the SvelteKit page owns the
// clock and pulls DOOM's framebuffer each frame to hand to thunk-wasm's
// Display-over-SpiBus pipeline.
//
// Key-conversion table + ring-buffer approach adapted from ozkl's
// doomgeneric_emscripten.c / doomgeneric_sdl.c (GPL-2.0), reworked to take
// pre-translated DOOM key codes straight from JS instead of SDL events.

#include "doomkeys.h"
#include "m_argv.h"
#include "doomgeneric.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#include <emscripten.h>
#include <emscripten/em_asm.h>

// ---------------------------------------------------------------------------
// Key ring buffer
// ---------------------------------------------------------------------------
#define KEYQUEUE_SIZE 64

static unsigned short s_KeyQueue[KEYQUEUE_SIZE];
static unsigned int s_KeyQueueWriteIndex = 0;
static unsigned int s_KeyQueueReadIndex = 0;

static void addKeyToQueue(int pressed, int doomKey)
{
    unsigned short keyData = (unsigned short)((pressed << 8) | (doomKey & 0xFF));
    s_KeyQueue[s_KeyQueueWriteIndex] = keyData;
    s_KeyQueueWriteIndex = (s_KeyQueueWriteIndex + 1) % KEYQUEUE_SIZE;
}

// ---------------------------------------------------------------------------
// Exported RGBA frame buffer (what JS putImageData consumes directly)
// ---------------------------------------------------------------------------
// DG_ScreenBuffer is filled by i_video.c in "rgba8888" mode: in little-endian
// memory each uint32 lands as bytes [B, G, R, A] with A = 0. Canvas ImageData
// wants [R, G, B, A]. We swizzle into s_Rgba and force A = 255.
static uint8_t s_Rgba[DOOMGENERIC_RESX * DOOMGENERIC_RESY * 4];

// ---------------------------------------------------------------------------
// doomgeneric platform hooks
// ---------------------------------------------------------------------------
void DG_Init(void)
{
    // Nothing to set up: JS owns the display surface and the clock.
}

void DG_DrawFrame(void)
{
    const uint8_t *in = (const uint8_t *)DG_ScreenBuffer;   // B,G,R,A per px
    uint8_t *out = s_Rgba;                                  // R,G,B,A per px
    const int n = DOOMGENERIC_RESX * DOOMGENERIC_RESY;
    for (int i = 0; i < n; i++) {
        out[0] = in[2]; // R
        out[1] = in[1]; // G
        out[2] = in[0]; // B
        out[3] = 255;   // A
        in += 4;
        out += 4;
    }
}

void DG_SleepMs(uint32_t ms)
{
    // No-op: JS drives frame pacing. Blocking here would stall the browser.
    (void)ms;
}

uint32_t DG_GetTicksMs(void)
{
    return (uint32_t)emscripten_get_now();
}

int DG_GetKey(int *pressed, unsigned char *doomKey)
{
    if (s_KeyQueueReadIndex == s_KeyQueueWriteIndex) {
        return 0; // empty
    }
    unsigned short keyData = s_KeyQueue[s_KeyQueueReadIndex];
    s_KeyQueueReadIndex = (s_KeyQueueReadIndex + 1) % KEYQUEUE_SIZE;
    *pressed = keyData >> 8;
    *doomKey = keyData & 0xFF;
    return 1;
}

void DG_SetWindowTitle(const char *title)
{
    (void)title; // headless
}

// ---------------------------------------------------------------------------
// Exported control surface (called from JS)
// ---------------------------------------------------------------------------
static char s_iwad[] = "freedoom1.wad";
static char s_gfxflag[] = "-gfxmode";
static char s_gfxval[]  = "rgba8888";

EMSCRIPTEN_KEEPALIVE
void dg_init(void)
{
    // argv[0] is conventional program name; then the iwad and gfx mode.
    static char argv0[] = "doom";
    char *argv[] = { argv0, s_iwad, s_gfxflag, s_gfxval };
    int argc = 4;
    doomgeneric_Create(argc, argv);
}

EMSCRIPTEN_KEEPALIVE
void dg_tick(void)
{
    doomgeneric_Tick();
}

EMSCRIPTEN_KEEPALIVE
void dg_key_down(int doomKey)
{
    addKeyToQueue(1, doomKey);
}

EMSCRIPTEN_KEEPALIVE
void dg_key_up(int doomKey)
{
    addKeyToQueue(0, doomKey);
}

// Pointer to the swizzled RGBA framebuffer (320*200*4 bytes).
EMSCRIPTEN_KEEPALIVE
uint8_t *dg_get_rgba(void)
{
    return s_Rgba;
}

// Pointer to the raw doomgeneric framebuffer (320*200 uint32, BGRA bytes).
EMSCRIPTEN_KEEPALIVE
uint32_t *dg_get_frame_ptr(void)
{
    return (uint32_t *)DG_ScreenBuffer;
}

EMSCRIPTEN_KEEPALIVE
int dg_width(void)  { return DOOMGENERIC_RESX; }

EMSCRIPTEN_KEEPALIVE
int dg_height(void) { return DOOMGENERIC_RESY; }

// Runtime start does nothing; JS calls dg_init() when it is ready.
int main(int argc, char **argv)
{
    (void)argc; (void)argv;
    return 0;
}
