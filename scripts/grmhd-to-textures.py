"""
Convert public GRMHD simulation datasets into browser-shippable textures:

  1) Yoon+ 2020 (Sgr A* high-res 3D GRMHD with radiative cooling).
     2D ray-traced intensity images at edge-on inclination (th0=90 deg)
     -> a packed PNG atlas at public/grmhd/inu_atlas.png + manifest JSON.

  2) Sosapanta-Salas+ 2025 (two-temperature MAD Sgr A*).
     Radially-averaged time series of density and B^2 -> small JSON
     so the shader can use real radial profiles for density and |B|
     while still synthesizing the angular structure procedurally.

Run:
  python scripts/grmhd-to-textures.py \
      --yoon /tmp/grmhd/yoon_unzip \
      --salas /tmp/grmhd/npz_unzip \
      --out public/grmhd

Both source datasets are CC-BY-4.0 licensed; cite the papers in the README.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image


# Plot-space domain that the simulation shader expects.
PLOT_XMIN, PLOT_XMAX = -60.0, 60.0
PLOT_YMIN, PLOT_YMAX = -30.0, 30.0

# Per-frame size we downsample the Yoon intensity images to (preserving the
# Yoon dataset's 2:1 aspect at our plot window).
TILE_W = 256
TILE_H = 128

# Atlas grid (frames laid out in columns x rows). Chosen so columns*rows
# >= number of frames in the source file. 11 cols fits the 101-frame Yoon
# inc90 file in an 11x10 grid; bump up if you bring in a longer time
# series.
ATLAS_COLS = 11


def load_npy(path: Path) -> np.ndarray:
    return np.load(path, allow_pickle=False)


# ---------------------------------------------------------------------------
# Yoon Inu -> atlas
# ---------------------------------------------------------------------------
def build_yoon_atlas(yoon_dir: Path, out_dir: Path) -> dict:
    inu = load_npy(yoon_dir / "Inu.npy")           # (T, H, W) float64
    xmin = float(load_npy(yoon_dir / "xmin.npy"))
    xmax = float(load_npy(yoon_dir / "xmax.npy"))
    ymin = float(load_npy(yoon_dir / "ymin.npy"))
    ymax = float(load_npy(yoon_dir / "ymax.npy"))
    t = load_npy(yoon_dir / "t.npy")               # (T,) in r_g/c
    th0 = float(load_npy(yoon_dir / "th0.npy"))
    tot_fnu = load_npy(yoon_dir / "totFnu.npy")    # (T,) total flux per frame

    n_frames, h, w = inu.shape
    print(f"Yoon Inu: {n_frames} frames, {h}x{w} px, "
          f"x in [{xmin:.1f}, {xmax:.1f}], y in [{ymin:.1f}, {ymax:.1f}], "
          f"inclination = {th0:.0f} deg")

    # Crop to plot-space domain.
    def to_idx(coord: float, lo: float, hi: float, n: int) -> int:
        return int(round((coord - lo) / (hi - lo) * n))

    ix0 = to_idx(PLOT_XMIN, xmin, xmax, w)
    ix1 = to_idx(PLOT_XMAX, xmin, xmax, w)
    iy0 = to_idx(PLOT_YMIN, ymin, ymax, h)
    iy1 = to_idx(PLOT_YMAX, ymin, ymax, h)
    print(f"  crop x:[{ix0}:{ix1}]  y:[{iy0}:{iy1}]")

    cropped = inu[:, iy0:iy1, ix0:ix1]              # (T, h', w')

    # Pillow expects image rows top->bottom but the simulation uses
    # mathematical y axis (positive up). Flip vertically.
    cropped = cropped[:, ::-1, :]

    # Sqrt-clip normalization. Log10 compresses brightness ratios so
    # aggressively that the actual ~50% frame-to-frame totFnu variation
    # gets squashed to <5% of the display range, making the playback look
    # static. Sqrt is a much gentler compression — a 2x brighter frame
    # looks ~40% brighter on screen, preserving the visible MAD pulsation.
    # We still clip the top 0.5% so the brightest hot-spot doesn't dictate
    # the whole range.
    cropped = np.maximum(cropped, 0.0)
    sqrt_inu = np.sqrt(cropped)

    vmin = float(np.percentile(sqrt_inu, 2))
    vmax = float(np.percentile(sqrt_inu, 99.5))
    norm = np.clip((sqrt_inu - vmin) / max(1e-9, vmax - vmin), 0.0, 1.0)
    print(f"  sqrt(Inu) range used for normalization: [{vmin:.2e}, {vmax:.2e}]")

    # Resample each frame to TILE_W x TILE_H.
    frames_u8 = np.empty((n_frames, TILE_H, TILE_W), dtype=np.uint8)
    for i in range(n_frames):
        img = Image.fromarray((norm[i] * 255).astype(np.uint8), mode="L")
        img = img.resize((TILE_W, TILE_H), Image.LANCZOS)
        frames_u8[i] = np.asarray(img)

    # Pack into an atlas (cols x rows) so the shader can sample with one
    # texture and offset by frame index.
    rows = (n_frames + ATLAS_COLS - 1) // ATLAS_COLS
    atlas = np.zeros((rows * TILE_H, ATLAS_COLS * TILE_W), dtype=np.uint8)
    for i in range(n_frames):
        r, c = divmod(i, ATLAS_COLS)
        atlas[r * TILE_H:(r + 1) * TILE_H, c * TILE_W:(c + 1) * TILE_W] = frames_u8[i]

    out_path = out_dir / "inu_atlas.png"
    Image.fromarray(atlas, mode="L").save(out_path, optimize=True)
    print(f"  wrote {out_path}  ({out_path.stat().st_size / 1024:.0f} KB)")

    return {
        "kind": "radiation_intensity",
        "source": "Yoon+ 2020 (Zenodo 3988208), CC-BY-4.0",
        "inclination_deg": th0,
        "frames": n_frames,
        "tile_w": TILE_W,
        "tile_h": TILE_H,
        "cols": ATLAS_COLS,
        "rows": rows,
        "plot_domain": {"xmin": PLOT_XMIN, "xmax": PLOT_XMAX, "ymin": PLOT_YMIN, "ymax": PLOT_YMAX},
        "t_sim": [float(x) for x in t.tolist()],
        "tot_fnu": [float(x) for x in tot_fnu.tolist()],
        "sqrt_min": vmin,
        "sqrt_max": vmax,
    }


# ---------------------------------------------------------------------------
# Salas radial profiles -> small JSON
# ---------------------------------------------------------------------------
def build_salas_profiles(salas_dir: Path, out_dir: Path) -> dict:
    r = load_npy(salas_dir / "r.npy")              # (520,)
    t = load_npy(salas_dir / "t.npy")              # (1603,)
    rho = load_npy(salas_dir / "aveRho.npy")       # (1603, 520)
    bsq = load_npy(salas_dir / "aveBsq.npy")       # (1603, 520)
    syn = load_npy(salas_dir / "radout_Sync_disk.npy")  # (1603, 520)

    print(f"Salas profiles: t={len(t)} steps in [{t.min():.0f},{t.max():.0f}] r_g/c, "
          f"r={len(r)} cells in [{r.min():.2f},{r.max():.0f}] r_g")

    # Restrict radius to plot domain (max r ~ 67 in the corner).
    r_max_plot = float(np.sqrt(PLOT_XMAX ** 2 + PLOT_YMAX ** 2)) * 1.05
    r_mask = r <= r_max_plot
    r_p = r[r_mask]
    rho_p = rho[:, r_mask]
    bsq_p = bsq[:, r_mask]
    syn_p = syn[:, r_mask]
    print(f"  trimmed to r <= {r_max_plot:.1f} -> {len(r_p)} radial cells")

    # Pick a time window in the developed-MAD regime (t > 15000 r_g/c) and
    # subsample to 120 frames so it loops nicely with the shader animation.
    n_out_frames = 120
    t_lo = max(15000.0, t.min())
    t_hi = t.max()
    t_targets = np.linspace(t_lo, t_hi, n_out_frames)
    idxs = [int(np.argmin(np.abs(t - tt))) for tt in t_targets]

    # Log-scale rho and bsq, linear for radial profile json
    def encode(field):
        sub = field[idxs]                # (n_out_frames, n_r)
        # Clip negatives, log-scale, then normalize to [0,1] using global span.
        sub = np.maximum(sub, 1e-12)
        log = np.log10(sub)
        vmin = float(np.percentile(log, 2))
        vmax = float(np.percentile(log, 99))
        normed = np.clip((log - vmin) / max(1e-9, vmax - vmin), 0.0, 1.0)
        return normed.astype(np.float32), vmin, vmax

    rho_e, rho_vmin, rho_vmax = encode(rho_p)
    bsq_e, bsq_vmin, bsq_vmax = encode(bsq_p)
    syn_e, syn_vmin, syn_vmax = encode(syn_p)

    payload = {
        "kind": "radial_profiles",
        "source": "Sosapanta-Salas+ 2025 MAD2TC (Zenodo 14793884), CC-BY-4.0",
        "frames": n_out_frames,
        "r": r_p.astype(np.float32).tolist(),
        "t_sim": t[idxs].astype(np.float32).tolist(),
        "rho": {"data": rho_e.tolist(), "log10_min": rho_vmin, "log10_max": rho_vmax},
        "bsq": {"data": bsq_e.tolist(), "log10_min": bsq_vmin, "log10_max": bsq_vmax},
        "syn": {"data": syn_e.tolist(), "log10_min": syn_vmin, "log10_max": syn_vmax},
    }

    out_path = out_dir / "radial_profiles.json"
    out_path.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"  wrote {out_path}  ({out_path.stat().st_size / 1024:.0f} KB)")

    return {
        "frames": n_out_frames,
        "radii": len(r_p),
        "rho_log10": [rho_vmin, rho_vmax],
        "bsq_log10": [bsq_vmin, bsq_vmax],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yoon", required=True,
                    help="path to unzipped Yoon Inu directory (contains Inu.npy)")
    ap.add_argument("--salas", required=True,
                    help="path to unzipped Salas postprocess directory (contains aveRho.npy)")
    ap.add_argument("--out", required=True,
                    help="output directory (typically public/grmhd)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict = {}
    manifest["radiation"] = build_yoon_atlas(Path(args.yoon), out_dir)
    manifest["profiles"] = build_salas_profiles(Path(args.salas), out_dir)

    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, separators=(",", ":")))
    print(f"wrote {out_dir/'manifest.json'}")


if __name__ == "__main__":
    sys.exit(main())
