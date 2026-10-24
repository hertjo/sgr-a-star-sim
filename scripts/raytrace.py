#!/usr/bin/env python3
"""Offline ray tracer: a Schwarzschild black hole with a turbulent, Doppler-beamed thin accretion disk.

Complements the interactive GRMHD viewer with a from-first-principles render. Every pixel of the image plane is a
light ray traced backwards through the Schwarzschild metric (G = c = M = 1):

* Geodesics. A photon with impact parameter b moves in a plane; with u = 1/r its orbit obeys u'' = 3u^2 - u,
  u(0) = 0, u'(0) = 1/b. The equation is integrated once (RK4) for a grid of b and tabulated as u(phi; b). Rays with
  b < 3*sqrt(3) fall in and make the shadow; rays just outside wind round the hole and make the photon ring.
* Disk crossings. For an observer at inclination i and an image point at angle alpha, the photon plane is spanned
  by the line of sight and the image direction. The ray meets the equatorial plane at orbit angles phi_1 in (0, pi)
  (the primary image) and phi_1 + pi (the secondary image, the disk's underside seen below the shadow).
* Emission. The disk is optically thick from the ISCO (r = 6) to R_OUT, with a Novikov-Thorne-like profile
  r^-3 (1 - sqrt(6/r)), beamed by g^4 with g = sqrt(1 - 3/r) / (1 - v . n_obs) for Keplerian gas, so the approaching
  side blazes and the receding side dims.
* Gas. Two noise textures, sheared into trailing spirals, turn at the Keplerian rate Omega = r^-3/2; two copies one
  loop apart are cross-faded so the animation loops seamlessly.
* Sky. Escaping rays sample a starfield through their total deflection, which bends the stars into an Einstein ring.
* Look. A two-scale bloom, faint helical jets along the spin axis, and an indigo-violet-cyan colour ramp.

The geometry is precomputed once per resolution; each frame only resamples the gas, so a 4K frame takes seconds.

Examples:
  python scripts/raytrace.py --still out.png --width 1920
  python scripts/raytrace.py --video out.mp4 --width 3840 --fps 30        # needs ffmpeg
  python scripts/raytrace.py --webp public/raytrace/blackhole.webp --width 960 --fps 15
Requires numpy and scipy (and Pillow for --still / --webp).
"""
import argparse
import subprocess
import sys

import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

BC = 3 * np.sqrt(3)            # critical impact parameter: the shadow's edge
R_IN, R_OUT = 6.0, 26.0        # disk from the innermost stable circular orbit outwards
ASPECT = 279 / 480             # height / width of the frame
FOV = 34.0                     # half-width of the view, in M

GROUND = "#23213f"
STOPS = [(0.0, GROUND), (0.10, "#3a36a0"), (0.32, "#6b67ee"), (0.62, "#5fd3f7"), (1.0, "#ffffff")]


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def trace_geodesics(bs, phis):
    """u(phi; b) for every b: -1 once the ray has escaped, 10 once it has fallen in."""
    u = np.zeros_like(bs)
    v = 1 / bs
    out = np.empty((len(phis), len(bs)), np.float32)
    out[0] = u
    h = phis[1] - phis[0]

    def f(u, v):
        return v, 3 * u * u - u

    for k in range(1, len(phis)):
        k1 = f(u, v)
        k2 = f(u + h / 2 * k1[0], v + h / 2 * k1[1])
        k3 = f(u + h / 2 * k2[0], v + h / 2 * k2[1])
        k4 = f(u + h * k3[0], v + h * k3[1])
        u = u + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
        v = v + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
        escaped = (out[k - 1] < 0) | ((u < 0) & (k > 1))
        captured = (out[k - 1] > 0.5) | (u > 0.5)
        u = np.where(escaped, -1.0, np.where(captured, 10.0, u))
        v = np.where(escaped | captured, 0.0, v)
        out[k] = u
    return out


class BlackHole:
    def __init__(self, width=1920, inclination=78.0, duration=24.0, seed=7):
        self.duration = duration
        self.px = width
        self.py = int(round(width * ASPECT))
        inc = np.radians(inclination)

        bs = np.r_[np.linspace(0.02, BC * 0.9995, 900), BC * (1 + np.geomspace(2e-6, FOV * 1.6 / BC, 1700))]
        phis = np.linspace(0, 3.2 * np.pi, 2400)
        U = trace_geodesics(bs, phis)
        phi_end = phis[np.argmax(U < 0, axis=0)]           # total deflection of each escaping ray
        phi_end[~(U < 0).any(axis=0)] = 0.0

        xs = ((np.arange(self.px) + 0.5 - self.px / 2) / (self.px / 2) * FOV).astype(np.float32)
        ys = (-(np.arange(self.py) + 0.5 - self.py / 2) / (self.px / 2) * FOV).astype(np.float32)
        X, Y = np.meshgrid(xs, ys)
        Y = Y - 1.5                                         # the hole a little above centre
        self.X, self.Y = X, Y
        B = np.hypot(X, Y)
        al = np.arctan2(Y, X)
        n_o = np.array([0.0, -np.sin(inc), np.cos(inc)])   # towards the observer; the disk is z = 0
        e_x = np.array([1.0, 0.0, 0.0])
        e_y = np.array([0.0, np.cos(inc), np.sin(inc)])
        D = (np.cos(al)[..., None] * e_x + np.sin(al)[..., None] * e_y).astype(np.float32)
        bi = np.interp(B, bs, np.arange(len(bs)))
        dphi = phis[1] - phis[0]

        def u_at(phi):
            pi = np.clip(phi / dphi, 0, len(phis) - 1)
            lin = map_coordinates(U, [pi, bi], order=1, mode="nearest")
            near = map_coordinates(U, [pi, bi], order=0, mode="nearest")
            return np.where((near < 0) | (near > 0.5), near, lin)

        phi1 = np.mod(np.arctan2(-n_o[2], D[..., 2]), np.pi)
        images = []
        for phi in (phi1, phi1 + np.pi):
            u = u_at(phi)
            ok = (u > 0) & (u < 0.5)
            r = np.where(ok, 1 / np.maximum(u, 1e-6), 0)
            pos = np.cos(phi)[..., None] * n_o + np.sin(phi)[..., None] * D
            th = np.arctan2(pos[..., 1], pos[..., 0])
            vhat = np.stack([-np.sin(th), np.cos(th), np.zeros_like(th)], -1)
            beta = np.sqrt(1 / np.maximum(r - 2, 0.5))
            g = np.sqrt(np.clip(1 - 3 / np.maximum(r, 3.01), 0, 1)) / (1 - beta * (vhat @ n_o))
            on = ok & (r >= R_IN) & (r <= R_OUT)
            rr = np.maximum(r, R_IN)
            em = np.where(on, rr ** -3 * (1 - np.sqrt(R_IN / rr)), 0)
            edge = np.clip((R_OUT - r) / 4, 0, 1)
            images.append(dict(on=on, r=r, th=th, I=em * g ** 4 * edge, front=on & ((pos @ n_o) > 0)))
        p1, p2 = images
        p2["I"] *= 0.55                                     # the underside: dimmer, partly hidden by the near disk
        use2 = ~p1["on"] & p2["on"]
        I0 = np.where(p1["on"], p1["I"], np.where(use2, p2["I"], 0))
        self.disk = p1["on"] | use2
        self.I0 = I0 / np.percentile(I0[self.disk], 99.3)
        RR = np.where(p1["on"], p1["r"], p2["r"])
        self.TH = np.where(p1["on"], p1["th"], p2["th"])
        self.OMEGA = np.maximum(RR, R_IN) ** -1.5
        self.RI = (np.log(np.maximum(RR, 1)) - np.log(R_IN)) / (np.log(R_OUT) - np.log(R_IN))

        self.captured = B < BC
        ring = np.exp(-((B - BC * 1.0006) / 0.16) ** 2) * 0.9 + np.exp(-((B - BC * 1.03) / 0.7) ** 2) * 0.18
        self.ring = ring * ~p1["front"]                     # the near disk passes in front of the ring

        pe = np.interp(B, bs, phi_end)
        sdir = np.cos(pe)[..., None] * n_o + np.sin(pe)[..., None] * D
        lon = np.arctan2(sdir[..., 1], sdir[..., 0])
        lat = np.arcsin(np.clip(sdir[..., 2], -1, 1))
        rng = np.random.default_rng(seed)
        sky = np.zeros((2400, 4800), np.float32)
        n = 9000
        sky[rng.integers(0, 2400, n), rng.integers(0, 4800, n)] = rng.random(n) ** 4 * 3.0
        sky = gaussian_filter(sky, 0.6)
        stars = map_coordinates(sky, [(lat / np.pi + 0.5) * 2399, (lon / (2 * np.pi) + 0.5) * 4799], order=1, mode="wrap")
        self.stars = stars * (~self.captured & ~self.disk) * np.clip((B - BC) / 6, 0, 1) ** 0.5

        noise = gaussian_filter(np.random.default_rng(seed - 4).random((96, 512)).astype(np.float32), (1.2, 3.0), mode="wrap")
        fine = gaussian_filter(np.random.default_rng(seed - 2).random((160, 1024)).astype(np.float32), (0.8, 1.6), mode="wrap")
        self.noise = (noise - noise.mean()) / noise.std()
        self.fine = (fine - fine.mean()) / fine.std()
        self.stops = [(a, hexrgb(c)) for a, c in STOPS]

    def gas(self, t):
        a = ((self.TH - self.OMEGA * t) / (2 * np.pi)) % 1.0
        spiral = (a + 0.55 * self.RI) % 1.0                 # filaments trail as spirals
        n1 = map_coordinates(self.noise, [self.RI * 95, spiral * 511], order=1, mode="wrap")
        n2 = map_coordinates(self.fine, [self.RI * 159, a * 1023], order=1, mode="wrap")
        return np.exp(0.42 * n1 + 0.22 * n2)

    def jets(self, t):
        ay = np.abs(self.Y)
        width = 0.5 + 0.045 * ay
        twist = 0.35 * width * np.sin(ay * 0.55 - t * 2.2 + np.sign(self.Y) * 1.3)
        core = np.exp(-((self.X - twist) / width) ** 2)
        knots = 0.65 + 0.35 * np.sin(ay * 0.9 - t * 3.0) ** 2
        return core * knots * np.clip(ay - 5, 0, 6) / 6 * np.exp(-ay / 16) * 0.075 * ~self.captured

    def ramp(self, v):
        v = np.clip(v, 0, 1)
        out = np.zeros(v.shape + (3,), np.float32)
        for (a, ca), (b, cb) in zip(self.stops[:-1], self.stops[1:]):
            m = (v >= a) & (v <= b)
            u = ((v - a) / (b - a))[m][:, None]
            out[m] = ca * (1 - u) + cb * u
        return out

    def frame(self, t):
        """The frame at time t (seconds) as an (H, W, 3) uint8 array; the loop is seamless over `duration`."""
        s = (t % self.duration) / self.duration
        T = self.duration * 9.0                             # gas time per loop: the inner orbits turn many times
        e = self.I0 * (np.cos(np.pi * s) ** 2 * self.gas(s * T) + np.sin(np.pi * s) ** 2 * self.gas((s - 1) * T))
        k = self.px / 800
        glow = gaussian_filter(e, 2.2 * k) * 0.55 + gaussian_filter(e, 9 * k) * 0.35
        v = 1 - np.exp(-(e * 1.15 + glow + self.ring * (0.55 + 0.45 * min(1.0, float(e.max()))) + self.jets(2 * np.pi * s)))
        img = self.ramp(v) + self.stars[..., None] * np.array([0.85, 0.9, 1.0], np.float32)
        img[self.captured & ~self.disk] = (0.03, 0.03, 0.07)
        return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--width", type=int, default=1920, help="frame width in pixels (height follows 480:279)")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float, default=24.0, help="loop length in seconds")
    ap.add_argument("--inclination", type=float, default=78.0, help="degrees between line of sight and disk axis")
    ap.add_argument("--still", help="write one frame (PNG)")
    ap.add_argument("--video", help="write the loop as H.264 MP4 (needs ffmpeg)")
    ap.add_argument("--webp", help="write the loop as an animated WebP (for the README)")
    a = ap.parse_args()
    if not (a.still or a.video or a.webp):
        ap.error("give --still, --video and/or --webp")
    bh = BlackHole(a.width, a.inclination, a.duration)
    n = int(round(a.duration * a.fps))
    if a.still:
        from PIL import Image
        Image.fromarray(bh.frame(3.0)).save(a.still)
    if a.video:
        enc = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                                "-s", f"{bh.px}x{bh.py}", "-r", str(a.fps), "-i", "-", "-c:v", "libx264", "-preset", "slow",
                                "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.video], stdin=subprocess.PIPE)
        for k in range(n):
            enc.stdin.write(bh.frame(k / a.fps).tobytes())
            print(f"\rframe {k + 1}/{n}", end="", file=sys.stderr)
        enc.stdin.close()
        enc.wait()
        print(file=sys.stderr)
    if a.webp:
        from PIL import Image
        frames = [Image.fromarray(bh.frame(k / a.fps)) for k in range(n)]
        frames[0].save(a.webp, save_all=True, append_images=frames[1:], duration=round(1000 / a.fps), loop=0,
                       quality=62, method=4)


if __name__ == "__main__":
    main()
