# Files and Devices

Here is one of the best ideas in the whole system: almost everything looks like a file.

A text document is a file. That is no surprise. But your keyboard is also reached through a file. So
is your sound card, your disk, and the display panel we will drive at the end of this course. The
kernel makes them all answer to the same small set of syscalls, `open`, `read`, `write`, `close`, so
a program can talk to a device without knowing the first thing about its hardware.

## File descriptors

When a program opens something, the kernel returns a small integer called a **file descriptor**, or
fd. It is not the file. It is a number that the program hands back to the kernel to say "the thing I
opened earlier." The kernel keeps the real details in its own file descriptor table; the program
only ever holds the number.

Three descriptors are open before your program even starts:

- `0` — standard input,
- `1` — standard output,
- `2` — standard error.

When you print to the screen, you are writing to fd `1`. When a shell pipes one program into
another, it is quietly swapping what fd `1` and fd `0` point at.

## The /dev directory

Devices show up as special files, usually under `/dev`. `/dev/null` throws away anything written to
it. A disk might be `/dev/sda`. A serial port might be `/dev/ttyUSB0`. Opening one of these and
writing to it sends bytes to real hardware, through the same `write` syscall you would use on a
document.

Devices come in two broad shapes. A **character device** moves a stream of bytes, one after another,
like a serial port or a keyboard. A **block device** moves fixed-size blocks and lets you jump
around, like a disk. The display we drive later behaves like a character device: we open it and push
bytes at it.

## When a file is not enough

Some device controls do not fit "read some bytes" or "write some bytes." Setting the baud rate on a
serial port, for example, is neither. For those, there is `ioctl`, a general-purpose syscall that
carries a device-specific command and some data. It is the escape hatch for everything the plain
file model does not cover.

That is the whole interface a program needs. Open a name, get a descriptor, read and write bytes,
close it. The kernel hides the enormous difference between a document and a display behind those
four calls.

## Key terms

- **file descriptor (fd)** — the small integer that names something a program has open.
- **/dev** — where devices appear as special files.
- **character vs block device** — a byte stream versus addressable fixed-size blocks.
- **ioctl** — the syscall for device controls that do not fit read/write.
