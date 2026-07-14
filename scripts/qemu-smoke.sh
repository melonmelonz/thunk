#!/usr/bin/env bash
# qemu-smoke: boot a real Linux kernel in QEMU where the static `thunk`
# binary is the only userspace, and prove the course runs there.
#
# This is the no-hardware rung between the in-process simulator and a real
# panel: same binary a facility would deploy, real kernel, emulated machine.
# The initramfs holds three files: /init (a short shell script), a static
# busybox to interpret it, and /thunk. /init runs `thunk sim --trace`,
# prints a sentinel if it exits cleanly, and powers the machine off. The
# host asserts the sentinel and a recognizable trace line came back over
# the serial console.
#
# Knobs (all optional):
#   THUNK_QEMU_KERNEL  kernel image to boot (else newest /boot/vmlinuz-*,
#                      else newest /usr/lib/modules/*/vmlinuz)
#   BUSYBOX            static busybox binary (else found on PATH / usual dirs)
#   QEMU               qemu binary (default: qemu-system-x86_64 on PATH)
#   THUNK_QEMU_TIMEOUT seconds before the boot is declared hung (default 120)
#
# TCG only; never asks for KVM, so it runs on any CI runner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SENTINEL='THUNK-QEMU-OK'
TIMEOUT="${THUNK_QEMU_TIMEOUT:-120}"

fail() {
    echo "qemu-smoke: $*" >&2
    exit 1
}

# --- resolve the kernel -----------------------------------------------------
resolve_kernel() {
    if [ -n "${THUNK_QEMU_KERNEL:-}" ]; then
        echo "$THUNK_QEMU_KERNEL"
        return
    fi
    local k
    # Classic layout first, then the ostree layout (kernels under /usr/lib/modules).
    k="$(ls -t /boot/vmlinuz-* 2>/dev/null | head -n 1 || true)"
    if [ -z "$k" ]; then
        k="$(ls -t /usr/lib/modules/*/vmlinuz 2>/dev/null | head -n 1 || true)"
    fi
    echo "$k"
}

KERNEL="$(resolve_kernel)"
[ -n "$KERNEL" ] || fail "no kernel found. Set THUNK_QEMU_KERNEL to a bootable \
x86_64 kernel image (e.g. /boot/vmlinuz-\$(uname -r))."
[ -r "$KERNEL" ] || fail "kernel '$KERNEL' is not readable. Copy it somewhere \
readable (sudo install -m 0644 $KERNEL /tmp/vmlinuz) and set THUNK_QEMU_KERNEL."

# --- resolve busybox (static; it is the only other program on board) --------
resolve_busybox() {
    if [ -n "${BUSYBOX:-}" ]; then
        echo "$BUSYBOX"
        return
    fi
    local c
    for c in "$(command -v busybox || true)" \
        /bin/busybox /usr/bin/busybox /sbin/busybox /usr/sbin/busybox; do
        if [ -n "$c" ] && [ -x "$c" ]; then
            echo "$c"
            return
        fi
    done
    echo ""
}

BB="$(resolve_busybox)"
[ -n "$BB" ] || fail "no busybox found. Install a static busybox \
(apt: busybox-static) or set BUSYBOX=/path/to/busybox."
if command -v file > /dev/null 2>&1; then
    file -L "$BB" | grep -Eq 'statically linked|static-pie linked' \
        || fail "'$BB' is not statically linked; the initramfs has no loader \
or libc. Use a static busybox (apt: busybox-static)."
fi

# --- resolve qemu ------------------------------------------------------------
QEMU="${QEMU:-qemu-system-x86_64}"
command -v "$QEMU" > /dev/null 2>&1 \
    || fail "'$QEMU' not found. Install qemu (apt: qemu-system-x86, \
dnf: qemu-system-x86, brew: qemu) or set QEMU=/path/to/qemu-system-x86_64."

# --- build the static course binary ------------------------------------------
echo "qemu-smoke: building thunk (x86_64-unknown-linux-musl, release)"
(cd "$ROOT" && cargo build --release -p thunk-cli \
    --target x86_64-unknown-linux-musl --locked)
BIN="$ROOT/target/x86_64-unknown-linux-musl/release/thunk"
[ -x "$BIN" ] || fail "expected static binary at $BIN"

# --- assemble the initramfs ---------------------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/root/bin" "$WORK/root/dev"
cp "$BIN" "$WORK/root/thunk"
cp "$BB" "$WORK/root/bin/busybox"
ln -s busybox "$WORK/root/bin/sh"

# PID 1. The kernel only opens a console for init if /dev/console exists in
# the initramfs; building device nodes needs root, so instead we mount
# devtmpfs (no root needed at build time) and point our own stdio at it.
cat > "$WORK/root/init" << EOF
#!/bin/sh
/bin/busybox mount -t devtmpfs devtmpfs /dev
exec > /dev/console 2>&1
echo "thunk: PID 1 on \$(/bin/busybox uname -r); userspace is one static binary"
if /thunk sim --trace > /trace.txt; then
    /bin/busybox head -n 40 /trace.txt
    echo $SENTINEL
else
    echo THUNK-QEMU-FAIL
fi
/bin/busybox poweroff -f
EOF
chmod 0755 "$WORK/root/init" "$WORK/root/thunk" "$WORK/root/bin/busybox"

(cd "$WORK/root" && find . -print0 \
    | cpio --null -o -H newc --quiet | gzip -1) > "$WORK/initramfs.gz"
echo "qemu-smoke: initramfs $(du -h "$WORK/initramfs.gz" | cut -f1) (thunk + busybox + 5-line init)"
echo "qemu-smoke: kernel   $KERNEL"

# --- boot ---------------------------------------------------------------------
LOG="$WORK/serial.log"
echo "qemu-smoke: booting (timeout ${TIMEOUT}s, TCG)"
rc=0
timeout "$TIMEOUT" "$QEMU" \
    -nographic -no-reboot -m 512 \
    -kernel "$KERNEL" \
    -initrd "$WORK/initramfs.gz" \
    -append "console=ttyS0 rdinit=/init panic=-1" \
    > "$LOG" 2>&1 || rc=$?

# --- verdict -------------------------------------------------------------------
ok=1
if [ "$rc" -eq 124 ]; then
    echo "qemu-smoke: boot timed out after ${TIMEOUT}s"
    ok=0
fi
grep -q "$SENTINEL" "$LOG" || {
    echo "qemu-smoke: sentinel '$SENTINEL' missing from serial output"
    ok=0
}
grep -q "SWRESET" "$LOG" || {
    echo "qemu-smoke: annotated trace (SWRESET) missing from serial output"
    ok=0
}

if [ "$ok" -eq 1 ]; then
    echo "qemu-smoke: PASS - kernel booted, thunk ran as the only userspace"
    echo "--- last lines of serial output ---"
    tail -n 12 "$LOG"
    exit 0
else
    echo "qemu-smoke: FAIL (qemu exit $rc)"
    echo "--- serial output ---"
    tail -n 60 "$LOG"
    exit 1
fi
