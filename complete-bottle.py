#!/usr/bin/env python3
"""Finish the water bottle that the photo cuts off at the bottom edge, and make it a bit bigger.

Usage:
  python3 complete-bottle.py originals/photo.png originals/photo-bottle.png

Then run make-caricature.py on originals/photo-bottle.png.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter

p = argparse.ArgumentParser()
p.add_argument('src')
p.add_argument('out')
p.add_argument('--left', type=int, default=1255, help='x where the bottle region starts (right of the jeans)')
p.add_argument('--seam', type=int, default=2250, help='y just below the fingers; the bottle grows from here')
p.add_argument('--body', type=int, default=280, help='px of bottle body to add below the photo')
p.add_argument('--grow', type=float, default=1.35, help='how much bigger the bottle gets')
args = p.parse_args()

src = np.array(Image.open(args.src).convert('RGBA')).astype(np.float32)
H, W = src.shape[:2]

# 1. Bottle extent just above the photo's soft bottom edge.
ref = H - 35
cols = np.where((src[ref, :, 3] > 128) & (np.arange(W) >= args.left))[0]
bx0, bx1 = int(cols.min()), int(cols.max())
bw = bx1 - bx0
cx = (bx0 + bx1) / 2

# 2. Paint the missing body: a white cylinder with soft shading and a rounded base.
pad_r = int(bw * args.grow * 0.4) + 20
ext = np.zeros((ref + args.body, W + pad_r, 4), np.float32)
ext[:H, :W] = src
u = np.clip((np.arange(bx0, bx1 + 1) - cx) / (bw / 2), -1, 1)
shade = 0.72 + 0.28 * np.sqrt(1 - u ** 2)
shade += 0.08 * np.exp(-((u + 0.45) ** 2) / 0.01)  # highlight stripe
base = np.array([238, 240, 244], np.float32)
ext[ref:, args.left:] = 0
for i in range(args.body):
    y = ref + i
    t = i / args.body
    rgb = base[None, :] * shade[:, None]
    if 0.28 < t < 0.33:  # grip band
        rgb *= 0.9
    # Rounded base: shrink the row width near the bottom.
    edge = 1.0
    if t > 0.88:
        k = (t - 0.88) / 0.12
        edge = np.sqrt(max(0.0, 1 - k ** 2))
    a = (np.abs(u) <= edge).astype(np.float32) * 255
    ext[y, bx0:bx1 + 1, :3] = np.clip(rgb, 0, 255)
    ext[y, bx0:bx1 + 1, 3] = a
# Fade the painted body up over the photo's bottom rows so there is no visible seam.
blend = 24
painted = base[None, :] * shade[:, None]
for i in range(blend):
    y = ref - blend + i
    w = (i / blend) ** 1.5
    row = ext[y, bx0:bx1 + 1]
    row[:, :3] = row[:, :3] * (1 - w) + painted * w
    row[:, 3] = np.maximum(row[:, 3], 255 * w)

# 3. Grow everything below the fingers, easing in so the handle stays attached.
region = ext[args.seam:, args.left:].copy()
ext[args.seam:, args.left:] = 0
ramp = 60
rows_out = []
src_y = 0.0
while src_y < region.shape[0] - 1:
    k = 1 + (args.grow - 1) * min(1.0, len(rows_out) / ramp)
    rows_out.append((src_y, k))
    src_y += 1 / k
rcx = cx - args.left
new_h = args.seam + len(rows_out)
out = np.zeros((max(new_h, ext.shape[0]), ext.shape[1], 4), np.float32)
out[:ext.shape[0]] = ext
xs_out = np.arange(out.shape[1] - args.left)
for j, (sy, k) in enumerate(rows_out):
    sx = rcx + (xs_out - rcx) / k
    valid = (sx >= 0) & (sx <= region.shape[1] - 1)
    row = region[int(round(sy))]
    sample = np.zeros((len(xs_out), 4), np.float32)
    sample[valid] = row[np.round(sx[valid]).astype(int)]
    dst = out[args.seam + j, args.left:]
    a = sample[:, 3:4] / 255
    dst[:, :3] = sample[:, :3] * a + dst[:, :3] * (1 - a)
    dst[:, 3] = np.maximum(dst[:, 3], sample[:, 3])

img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
img = img.crop(img.getbbox())
img.save(args.out)
print(f'saved {args.out} {img.size}; bottle x {bx0}-{bx1}')
