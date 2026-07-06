# thunk

*A systems course for justice-impacted learners. Offline, from the ground up.*

**Working title. One page. — Penn Porterfield, 2026-07-06**

---

I taught myself to build a 1-bit RPG on a graphing calculator in the honor block of a maximum
security prison. I wrote a hex mapper in TI-BASIC to handle the pixels. Later I worked through the
whole "You Don't Know JavaScript" series on a locked-down library browser, saving my progress to
local storage because that was the only storage I was allowed. I put that together out of what I
could get my hands on.

Every coding program for justice-impacted people teaches web development. The Last Mile teaches
JavaScript and React. Justice Through Code teaches Python. These are good programs and I am glad they
exist. But web dev is the most crowded corner of the industry, and teaching it inside a facility is
a little strange anyway; you cannot use the internet the learner is practicing for, so you mirror a
fake one in for them. Everyone ends up on the same on-ramp.

I could not find one prison or reentry program that teaches systems, embedded, or kernel work. There
is a reason the space is empty: low-level work usually needs hardware, and hardware does not clear
facility review.

thunk is one offline Rust program that fixes that. No network, no installer, runs on a stock
locked-down machine. It teaches from true zero, at your own pace: programs and the kernel, Rust, the
syscall boundary, the SPI bus, driving a display. It ends with DOOM booting on a screen you drove
yourself from the metal up. The whole low-level stack is simulated in software, so a learner with no
hardware still reaches the end. For anyone who can get a cheap board and a logic analyzer, the same
course drives the real thing.

Why now: Rust just became a first-class part of the Linux kernel, and there is still no Rust SPI
abstraction in mainline. Embedded and systems roles are short-staffed and pay well while junior web
dev is a bloodbath. This points people at the door that is open.

I am doing the kernel capstone it teaches toward myself, right now: a Rust driver for an SPI display
with DOOM on it, on a BeaglePlay, traced on a Saleae Logic 8.

It is free and open-source. There is no sponsor yet. Saleae runs a student discount and pays $200
for a project writeup; that is money I can actually collect and put toward hardware, and a bigger
ask is a conversation I intend to start. I have already completed most of this and intend to reach out to
Kenyata as well to talk about potentially getting this into an actual facility.

I have a much more detailed writeup if you would like but this is the elevator pitch.
