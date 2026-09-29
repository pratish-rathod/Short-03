#!/usr/bin/env python3
"""Synthesise the sound-design track for Books Are Slow.

No music and no voice: foley-style SFX only (paper, clay, wood, pencil,
switches, small UI pops). Every cue is keyed to the same shot timings as
books-are-slow.jsx (SHOT_T0), and each shot is rendered to its own clip,
audio/sfx-NN.wav, lasting the shot plus its 1 s hold. The player in
books-are-slow.jsx plays each clip from its scene cue, so retiming or
reordering scenes in the motion editor keeps the sound in sync.

Run from the repo root:  python3 tools/make_sfx.py
"""
import math
import os
import wave

import numpy as np

SR = 44100
GAP = 1.0  # silent hold after each shot (matches OM_SCENES durations)
rng = np.random.default_rng(7)

SHOT_T0 = [
    ('01 Hook', 0), ('02 Ten-minute video', 4.22), ('03 Up to speed', 9.38), ('04a Makes sense', 13.21),
    ('04b Cannot teach it', 16.33), ('05 A book', 19.03), ('06a Same idea', 20.76), ('06b Example', 23.28),
    ('06c Work through', 25.65), ('07 Building on', 28.05), ('08 Starting over', 33.57), ('09 Scrolling', 37.31),
    ('10 Take longer', 40.19), ('11 Learn AI', 45.49), ('12 First book', 48.57), ('13 Second book', 54.09),
    ('14 Return to it', 59.45), ('15 Expert advice', 65.34), ('16 Launch event', 68.62),
]
VO_END = 72.76


# ---------------------------------------------------------------- dsp helpers
def n_(sec):
    return max(1, int(round(sec * SR)))


def t_(n):
    return np.arange(n) / SR


def noise(sec):
    return rng.standard_normal(n_(sec))


def svf(x, fc, q=0.707, mode='band'):
    """TPT state-variable filter; fc may be a scalar or a per-sample array."""
    n = len(x)
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    ic1 = ic2 = 0.0
    out = np.empty(n)
    xs = x.tolist(); A1 = a1.tolist(); A2 = a2.tolist(); A3 = a3.tolist()
    for i in range(n):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        if mode == 'band':
            out[i] = v1
        elif mode == 'low':
            out[i] = v2
        else:
            out[i] = xs[i] - k * v1 - v2
    return out


def env(n, a=0.005, d=0.2, shape=1.0):
    """Linear attack, exponential decay (d = time to -60 dB)."""
    t = t_(n)
    e = np.exp(-6.9 * np.maximum(t - a, 0) / d)
    if a > 0:
        e = np.where(t < a, (t / a) ** shape, e)
    return e


def hump(n, peak=0.6, p=1.6):
    """Smooth rise and fall, peak at fraction `peak` of the length."""
    u = np.linspace(0, 1, n)
    e = np.where(u < peak, np.sin(0.5 * np.pi * u / peak), np.cos(0.5 * np.pi * (u - peak) / (1 - peak)))
    return np.clip(e, 0, 1) ** p


def norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def sine_glide(sec, f0, f1, curve='exp'):
    n = n_(sec)
    u = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** u if curve == 'exp' else f0 + (f1 - f0) * u
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------------------------------------------------------------- sound kit
def whoosh(dur=0.45, f0=400, f1=2200, q=1.4, peak=0.55, amp=0.5):
    x = noise(dur)
    fc = f0 * (f1 / f0) ** np.linspace(0, 1, len(x))
    y = svf(x, fc, q) + 0.35 * svf(x, fc * 0.5, 0.8, 'low')
    return amp * norm(y) * hump(len(y), peak)


def thud(f=70, dur=0.35, amp=0.9, body=0.5):
    n = n_(dur)
    t = t_(n)
    f_t = f * (1 + 0.7 * np.exp(-t / 0.018))
    tone = np.sin(2 * np.pi * np.cumsum(f_t) / SR) * env(n, 0.002, dur)
    k = noise(0.05)
    k = svf(k, 900, 0.7, 'low') * env(len(k), 0.001, 0.05)
    out = tone.copy()
    out[:len(k)] += body * norm(k)
    return amp * norm(out)


def book_slam(amp=1.0):
    """Heavy hardback landing: low body + papery slap + short rattle."""
    b = thud(58, 0.55, 1.0, 0.8)
    s = noise(0.12)
    s = svf(s, 1700, 0.9) * env(len(s), 0.001, 0.1)
    out = b.copy()
    out[:len(s)] += 0.55 * norm(s)
    return amp * norm(out)


def book_set(amp=0.55):
    """Lighter book or block set on the table."""
    b = thud(95, 0.25, 1.0, 0.7)
    s = noise(0.06)
    s = svf(s, 2200, 0.8) * env(len(s), 0.001, 0.05)
    out = b.copy()
    out[:len(s)] += 0.4 * norm(s)
    return amp * norm(out)


def pop(f=700, amp=0.45, dur=0.12):
    """Soft paper-cutout pop (mouth-pop style upward glide)."""
    n = n_(dur)
    y = sine_glide(dur, f * 0.55, f * 1.35) * env(n, 0.003, dur * 0.8)
    c = svf(noise(0.008), 3000, 1.0) * env(n_(0.008), 0.0005, 0.008)
    y[:len(c)] += 0.3 * norm(c)
    return amp * norm(y)


def unpop(f=700, amp=0.3):
    y = sine_glide(0.1, f * 1.3, f * 0.6) * env(n_(0.1), 0.004, 0.08)
    return amp * norm(y)


def click(f=3200, amp=0.35, dur=0.02):
    x = noise(dur)
    y = svf(x, f, 3.0) * env(len(x), 0.0005, dur)
    return amp * norm(y)


def wood(f=1400, amp=0.4, dur=0.12, q=18):
    """Small wooden tock (blocks, clock ticks)."""
    x = np.zeros(n_(dur))
    x[:40] = rng.standard_normal(40)
    y = svf(x, f, q) + 0.6 * svf(x, f * 2.7, q)
    return amp * norm(y * env(len(y), 0.0005, dur))


def switch(amp=0.5):
    """Lamp / pull-chain switch: two close clicks."""
    a = click(2600, 1.0, 0.015)
    b = click(1800, 0.8, 0.02)
    out = np.zeros(n_(0.07))
    out[:len(a)] += a
    o = n_(0.035)
    out[o:o + len(b)] += b
    return amp * norm(out)


def ding(f=1320, amp=0.3, dur=1.2):
    n = n_(dur)
    t = t_(n)
    parts = [(1, 1.0, 1.0), (2.76, 0.45, 0.55), (5.4, 0.22, 0.3), (8.93, 0.1, 0.18)]
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-6.9 * t / (dur * d)) for r, a, d in parts)
    y *= np.minimum(1, t / 0.002)
    return amp * norm(y)


def sparkle(f=2400, amp=0.2, count=5, span=0.35):
    out = np.zeros(n_(span + 0.6))
    for i in range(count):
        at = n_(span * i / max(1, count - 1))
        d = ding(f * (1 + 0.25 * rng.random()) * (1.06 ** i), 1.0, 0.5)
        out[at:at + len(d)] += d * (0.8 ** i)
    return amp * norm(out)


def scratch(dur=0.8, amp=0.35, rate=9.0, f=3600):
    """Pencil on paper: band noise gated by irregular strokes plus grain."""
    x = noise(dur)
    y = svf(x, f, 1.3) + 0.4 * svf(x, 1400, 1.0)
    t = t_(len(x))
    ph = 2 * np.pi * np.cumsum(rate * (1 + 0.35 * np.sin(2 * np.pi * 1.3 * t + rng.random() * 6))) / SR
    strokes = 0.35 + 0.65 * np.abs(np.sin(ph)) ** 1.5
    grain = 1 + 0.6 * (rng.random(len(x)) > 0.985)
    e = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04)
    return amp * norm(y * strokes * grain * e)


def flip(dur=0.4, amp=0.45):
    """Page turn: fluttery high noise ending in a light slap."""
    x = noise(dur)
    y = svf(x, 2600, 0.8) + 0.5 * svf(x, 6000, 1.0)
    t = t_(len(x))
    flutter = 0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(38 - 26 * t / dur) / SR) ** 2
    y = y * flutter * hump(len(x), 0.7, 1.3)
    s = svf(noise(0.04), 1500, 0.9) * env(n_(0.04), 0.001, 0.035)
    e = len(y) - len(s)
    y[e:] += 0.7 * norm(s) * np.max(np.abs(y))
    return amp * norm(y)


def flick(amp=0.3):
    """Single tear-off calendar page."""
    x = noise(0.09)
    y = svf(x, 3200, 1.1) * hump(len(x), 0.25, 1.2)
    return amp * norm(y)


def rustle(dur=0.6, amp=0.25):
    x = noise(dur)
    y = svf(x, 3000, 0.7)
    t = t_(len(x))
    mod = np.clip(svf(rng.standard_normal(len(x)), 12, 0.7, 'low') * 30, 0, None)
    return amp * norm(y * (0.25 + mod) * hump(len(x), 0.5, 1.0))


def creak(dur=1.2, amp=0.3, f0=38, f1=62):
    """Stiff hardback spine: stick-slip pulse train through a body resonance."""
    n = n_(dur)
    u = np.linspace(0, 1, n)
    f = f0 + (f1 - f0) * u + 6 * np.sin(2 * np.pi * 1.7 * u)
    ph = np.cumsum(f) / SR
    pulses = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    pulses[idx] = 0.6 + 0.4 * rng.random(len(idx))
    y = svf(pulses, 650, 6) + 0.5 * svf(pulses, 1500, 5)
    return amp * norm(y * hump(n, 0.4, 0.8))


def squish(amp=0.35, f0=520, f1=220, dur=0.1):
    """Clay squash / hop landing."""
    x = noise(dur)
    fc = np.geomspace(f0, f1, len(x))
    y = svf(x, fc, 4) * env(len(x), 0.004, dur)
    return amp * norm(y)


def hop(amp=0.25, f=320):
    """Little springy jump for the clay figure."""
    y = sine_glide(0.16, f, f * 2.1) * hump(n_(0.16), 0.3, 1.2)
    return amp * norm(y)


def step(amp=0.18):
    x = noise(0.05)
    y = svf(x, 420, 1.2, 'low') * env(len(x), 0.003, 0.045)
    return amp * norm(y)


def slap(amp=0.6):
    """Sticker slapped on: sharp flat hit + tiny adhesive peel tail."""
    x = noise(0.03)
    y = svf(x, 1200, 0.7, 'high') * env(len(x), 0.0005, 0.03)
    b = thud(140, 0.12, 1.0, 0.3)
    out = np.zeros(n_(0.14))
    out[:len(b)] += 0.6 * b
    out[:len(y)] += norm(y)
    return amp * norm(out)


def fizzle(amp=0.35):
    """Bulb going dark: crackle + descending 'womp'."""
    dur = 0.6
    out = np.zeros(n_(dur))
    for at in (0.0, 0.09, 0.19):
        c = click(2200 + 1500 * rng.random(), 1.0, 0.02)
        o = n_(at)
        out[o:o + len(c)] += c
    w = sine_glide(0.45, 420, 110) * hump(n_(0.45), 0.15, 1.0)
    o = n_(0.12)
    out[o:o + len(w)] += 0.6 * w
    return amp * norm(out)


def ff_whirr(dur=2.3, amp=0.22):
    """Fast-forward: accelerating tape chatter plus a rising hum."""
    n = n_(dur)
    t = t_(n)
    rate = 10 + 26 * (t / dur)
    ph = np.cumsum(rate) / SR
    gate = (np.sin(2 * np.pi * ph) > 0.6).astype(float)
    x = svf(rng.standard_normal(n), 2600, 2.0) * svf(gate, 60, 0.7, 'low') * 4
    hum = np.sin(2 * np.pi * np.cumsum(180 + 160 * t / dur) / SR) * 0.25
    y = (x + hum) * np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.12)
    return amp * norm(y)


def sand(dur=3.9, amp=0.12):
    x = noise(dur)
    y = svf(x, 5200, 0.9)
    grains = svf((rng.random(len(x)) > 0.992).astype(float) * rng.standard_normal(len(x)), 3800, 2)
    t = t_(len(x))
    e = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.5)
    return amp * norm((0.4 * norm(y) + norm(grains)) * e)


def swipe(amp=0.18):
    x = noise(0.22)
    fc = np.geomspace(1800, 700, len(x))
    return amp * norm(svf(x, fc, 1.2) * hump(len(x), 0.35, 1.3))


def rise(dur=1.25, f0=440, f1=880, amp=0.12):
    y = sine_glide(dur, f0, f1) + 0.3 * sine_glide(dur, f0 * 2, f1 * 2)
    return amp * norm(y * hump(n_(dur), 0.8, 1.0))


def boing(f=260, amp=0.3, dur=0.45):
    n = n_(dur)
    t = t_(n)
    fr = f * (1 + 0.25 * np.exp(-t / 0.08) * np.sin(2 * np.pi * 16 * t))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.004, dur)
    return amp * norm(y)


def tick(amp=0.12):
    return wood(4200, amp, 0.04, 10)


def dust(amp=0.3):
    x = noise(0.5)
    y = svf(x, 900, 0.6, 'low') + 0.3 * svf(x, 3000, 0.7)
    return amp * norm(y * env(len(x), 0.02, 0.45))


def tumble(n_blocks, amp=0.45, spread=0.05, base=1100):
    out = np.zeros(n_(spread * n_blocks + 0.8))
    for i in range(n_blocks):
        for bounce in range(2):
            at = spread * i + 0.28 + bounce * (0.11 + 0.04 * rng.random())
            w = wood(base * (0.8 + 0.5 * rng.random()), 1.0 * (0.5 if bounce else 1), 0.1, 12)
            o = n_(at)
            out[o:o + len(w)] += w
    s = whoosh(0.3, 900, 500, 1.0, 0.3, 0.5)
    out[:len(s)] += s
    return amp * norm(out)


def stomp(amp=0.35):
    return amp * norm(thud(85, 0.2, 1.0, 0.6))


def string_pull(amp=0.3):
    return whoosh(0.18, 2500, 5000, 2.0, 0.4, amp)


# ---------------------------------------------------------------- cue sheet
# (absolute voiceover-time seconds, sound array, pan -1..1)
def pan_x(x):  # drawing units 0..180 -> stereo position
    return max(-0.7, min(0.7, (x - 90) / 90 * 0.7))


CUES = []


def cue(at, snd, pan=0.0, gain=1.0):
    CUES.append((at, snd * gain, pan))


# 01 Hook — hanging tag swings, hardcover opens by itself
cue(0.05, whoosh(0.7, 300, 900, 1.0, 0.5, 0.18), 0)
cue(0.85, creak(0.5, 0.12, 50, 70), 0)
cue(0.25, creak(3.3, 0.22, 30, 55), pan_x(110))
cue(2.6, rustle(1.0, 0.16), pan_x(110))
cue(3.62, flip(0.3, 0.25), pan_x(110))
cue(3.65, squish(0.2), pan_x(30))

# 02 Ten-minute video — phone slides in, chat bubble pops, typing dots
cue(6.45, whoosh(0.5, 500, 2400, 1.3, 0.7, 0.4), pan_x(10))
cue(6.95, book_set(0.3), pan_x(40))
cue(7.41, pop(760, 0.5), pan_x(118))
for i, at in enumerate(np.arange(8.42, 9.3, 1 / 6)):
    cue(float(at), tick(0.12), pan_x(108 + 10 * (i % 3)))

# 03 Up to speed — bubble leaves, 2x chip, video races down, check
cue(9.38, unpop(760, 0.3), pan_x(118))
cue(10.39, pop(1050, 0.45), pan_x(60))
cue(10.45, step(), pan_x(118))
cue(10.65, step(), pan_x(108))
cue(10.6, ff_whirr(2.3, 0.26), pan_x(47))
for at in np.arange(10.6, 12.85, 0.09):
    cue(float(at), tick(0.07), pan_x(47))
cue(12.9, ding(1568, 0.28, 0.9), pan_x(47))
cue(12.9, pop(900, 0.25), pan_x(47))

# 04a Makes sense — tick drawn, label pops, bulb switches on
cue(14.1, scratch(0.3, 0.2, 14, 3900), pan_x(22))
cue(14.4, ding(1760, 0.16, 0.6), pan_x(22))
cue(15.45, switch(0.45), pan_x(100))
cue(15.47, ding(1046, 0.3, 1.4), pan_x(100))
cue(15.5, pop(640, 0.4), pan_x(96))
cue(15.55, sparkle(2200, 0.12, 4, 0.25), pan_x(100))

# 04b Cannot teach it — bubble, words turn to scribble, "?", bulb dies
cue(16.6, pop(700, 0.45), pan_x(80))
cue(17.44, scratch(0.86, 0.3, 11, 3300), pan_x(90))
cue(17.95, boing(210, 0.3, 0.4), pan_x(142))
cue(18.36, fizzle(0.4), pan_x(50))

# 05 A book — book slides in, slams with dust, lamp clicks on
cue(19.12, whoosh(0.35, 300, 800, 1.2, 0.5, 0.18), pan_x(190))
cue(19.3, squish(0.2, 400, 180), pan_x(30))
cue(19.8, whoosh(0.42, 350, 1600, 1.1, 0.8, 0.45), pan_x(140))
cue(20.2, book_slam(0.95), pan_x(110))
cue(20.22, dust(0.25), pan_x(110))
cue(20.4, switch(0.5), pan_x(140))
cue(20.43, ding(880, 0.08, 0.9), pan_x(140))

# 06a Same idea — overhead, the shadow sweeps slowly across the page
cue(20.95, whoosh(1.9, 250, 700, 0.8, 0.5, 0.2), 0)
cue(21.1, rustle(1.4, 0.12), pan_x(60))
cue(22.75, squish(0.1, 380, 260), pan_x(118))

# 06b Example — page flips to the example and back
cue(23.38, flip(0.42, 0.5), pan_x(110))
cue(24.65, flip(0.4, 0.45), pan_x(80))

# 06c Work through — pencil in, underline, "?" struck, "!" appears, pencil out
cue(25.62, whoosh(0.25, 800, 2600, 1.3, 0.6, 0.2), pan_x(160))
cue(25.85, scratch(1.45, 0.26, 7, 3400), pan_x(60))
cue(27.45, scratch(0.14, 0.3, 20, 4000), pan_x(20))
cue(27.7, pop(1200, 0.35), pan_x(20))
cue(27.75, whoosh(0.3, 2600, 900, 1.3, 0.4, 0.2), pan_x(160))

# 07 Building on — chapters drop into a staircase, Reader climbs, thread links
lands = [28.64, 29.6, 30.58]
xs = [71, 109, 147]
for at, x in zip(lands, xs):
    cue(at - 0.3, whoosh(0.32, 500, 1100, 1.2, 0.8, 0.14), pan_x(x))
    cue(at, book_set(0.5), pan_x(x))
    cue(at + 0.12, hop(0.2, 300 + 40 * lands.index(at)), pan_x(x))
    cue(at + 0.42, squish(0.16), pan_x(x))
cue(31.35, rise(1.25, 392, 784, 0.07), 0)
for i, (at, f) in enumerate(zip([31.35, 31.77, 32.18, 32.6], [784, 880, 1046, 1318])):
    cue(at, ding(f, 0.14, 0.7), pan_x(21 + 38 * i))
cue(31.35, pop(620, 0.3), 0)
cue(33.13, sparkle(2400, 0.12, 5, 0.3), pan_x(147))

# 08 Starting over — towers build, topple, start again (three times)
for ti, (ap, tp, nb) in enumerate(zip([33.57, 34.55, 35.6], [33.98, 35.05, 36.91], [4, 6, 7])):
    cue(ap, whoosh(0.4, 700, 1900, 1.4, 0.5, 0.12), pan_x(92))
    for j in range(min(nb, 4)):
        cue(ap + 0.03 + j * 0.05, wood(1300 + 200 * j, 0.12, 0.08), pan_x(92))
    cue(tp - 0.28, tumble(nb, 0.4 + 0.05 * ti, 0.05, 1000 + 150 * ti), pan_x(92))
    cue(tp, stomp(0.3 + 0.05 * ti), pan_x(22))
cue(35.05, scratch(0.36, 0.28, 16, 2600), pan_x(33))

# 09 Scrolling — endless feed runs through the phone frame
cue(37.93, whoosh(2.25, 600, 900, 0.8, 0.5, 0.12), pan_x(90))
for at in np.arange(37.93, 40.1, 38 / 64):
    cue(float(at), swipe(0.26), pan_x(90))
    cue(float(at) + 0.18, tick(0.05), pan_x(90))

# 10 Take longer — settles into the book chair, hourglass drains, meter fills
cue(40.2, whoosh(0.3, 400, 800, 1.0, 0.5, 0.08), pan_x(104))
cue(40.83, whoosh(0.5, 600, 250, 1.0, 0.7, 0.12), pan_x(90))
cue(41.35, squish(0.35, 300, 120, 0.22), pan_x(82))
cue(41.2, flip(0.3, 0.2), pan_x(82))
cue(41.5, sand(3.9, 0.12), pan_x(144))
for at in np.arange(40.5, 45.4, 1.0):
    cue(float(at), wood(3000, 0.06, 0.05, 10), pan_x(144))
cue(43.61, rise(1.15, 330, 660, 0.06), pan_x(18))
cue(44.76, pop(980, 0.3), pan_x(18))
cue(44.78, ding(1318, 0.22, 1.0), pan_x(18))

# 11 Learn AI — pop-up neural network unfolds out of the open book
cue(46.6, flip(0.35, 0.3), 0)
cue(46.69, whoosh(0.9, 300, 1800, 1.2, 0.7, 0.18), 0)
nodes = [(50, 120), (50, 160), (90, 96), (90, 138), (90, 176), (130, 116), (130, 156)]
for i, (x, _) in enumerate(nodes):
    cue(46.85 + i * 0.15, pop(600 + 70 * i, 0.22, 0.09), pan_x(x))
cue(48.21, sparkle(2600, 0.12, 4, 0.25), pan_x(146))

# 12 First book — Reader walks over, pats book one, sticker slaps on
for i, at in enumerate(np.arange(48.72, 50.3, 1 / 6)):
    cue(float(at), step(0.14 + 0.03 * (i % 2)), pan_x(200 - 55 * (at - 48.7) / 1.6))
cue(50.3, squish(0.12), pan_x(148))
for at in (53.22, 53.39, 53.55):
    cue(at, book_set(0.18), pan_x(128))
cue(53.61, slap(0.6), pan_x(126))
cue(53.63, sparkle(2000, 0.08, 3, 0.18), pan_x(126))

# 13 Second book — kraft parcel slides in, calendar flips to OCT 20
cue(54.3, whoosh(0.55, 300, 900, 1.0, 0.8, 0.3), pan_x(-40))
cue(54.85, thud(110, 0.3, 0.45, 0.8), pan_x(70))
cue(54.87, rustle(0.3, 0.12), pan_x(70))
dt = (58.94 - 55.28) / 19
for j in range(19):
    cue(55.28 + j * dt, flick(0.22 + 0.1 * (j / 19)), pan_x(148 + (30 if j % 2 == 0 else -30)))
cue(58.94, pop(820, 0.4), pan_x(148))
cue(58.96, ding(1568, 0.22, 1.1), pan_x(148))
cue(59.0, sparkle(2400, 0.08, 3, 0.2), pan_x(148))

# 14 Return to it — day tabs sprout; the page turns back to each one
for at, x in zip([61.17, 61.94, 63.03, 64.64], [49, 75, 111, 137]):
    cue(at, whoosh(0.2, 1400, 3200, 1.6, 0.4, 0.14), pan_x(x))
    cue(at + 0.22, pop(900, 0.18, 0.08), pan_x(x))
    cue(at + 0.2, flip(0.3, 0.28), pan_x(90))

# 15 Expert advice — five blocks snap onto book two, the thread ties a bow
for i in range(5):
    cue(66.58 + i * 0.167, wood(900 + 160 * i, 0.4, 0.12, 16), pan_x(90))
    cue(66.58 + i * 0.167, click(3000, 0.12, 0.012), pan_x(90))
cue(67.45, string_pull(0.3), pan_x(90))
cue(68.06, whoosh(0.2, 1800, 4200, 2.0, 0.3, 0.22), pan_x(90))
cue(68.12, pop(1300, 0.3), pan_x(90))
cue(68.15, ding(1046, 0.16, 1.0), pan_x(90))

# 16 Launch event — card springs up, Reader waves, final chime
cue(69.8, whoosh(0.35, 500, 2200, 1.2, 0.8, 0.2), pan_x(92))
cue(69.87, boing(330, 0.3, 0.55), pan_x(92))
cue(70.1, rustle(0.3, 0.1), pan_x(92))
cue(71.12, hop(0.14, 520), pan_x(140))
cue(71.15, sparkle(2200, 0.1, 4, 0.3), pan_x(140))
cue(72.3, ding(784, 0.14, 1.6), 0)
cue(72.3, ding(1175, 0.1, 1.6), 0)


# ---------------------------------------------------------------- render
def scene_of(at):
    i = 0
    while i + 1 < len(SHOT_T0) and at >= SHOT_T0[i + 1][1]:
        i += 1
    return i


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')
    os.makedirs(root, exist_ok=True)
    MASTER = 0.8
    for i, (name, t0) in enumerate(SHOT_T0):
        end = SHOT_T0[i + 1][1] if i + 1 < len(SHOT_T0) else VO_END
        n = n_(end - t0 + GAP)
        L = np.zeros(n)
        R = np.zeros(n)
        for at, snd, pan in CUES:
            if scene_of(at) != i:
                continue
            o = n_(at - t0) if at > t0 else 0
            seg = snd[: max(0, n - o)]
            th = (pan + 1) * np.pi / 4
            L[o:o + len(seg)] += seg * math.cos(th) * math.sqrt(2)
            R[o:o + len(seg)] += seg * math.sin(th) * math.sqrt(2)
        st = np.stack([L, R], 1) * MASTER
        st = np.tanh(st * 1.1) / np.tanh(1.1)  # gentle soft-clip limiter
        fade = n_(0.03)
        st[-fade:] *= np.linspace(1, 0, fade)[:, None]
        pcm = (np.clip(st, -1, 1) * 32767 * 0.95).astype('<i2')
        path = os.path.join(root, f'sfx-{i + 1:02d}.wav')
        with wave.open(path, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        print(f'{path}: {name} ({n / SR:.2f}s, peak {np.max(np.abs(st)):.2f})')


if __name__ == '__main__':
    main()
