#!/usr/bin/env python3
"""Turn a transparent cut-out photo into a big-head cartoon avatar.

Usage:
  python3 make-caricature.py originals/photo-bottle.png avatars/default/idle.png \
      --chin 485 --face-x 607 --head-scale 1.7 --body-scale 0.72

--chin    y pixel of the chin in the source photo (where the head is cut)
--face-x  x pixel of the face centre in the source photo
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps

p = argparse.ArgumentParser()
p.add_argument('src')
p.add_argument('out')
p.add_argument('--chin', type=int, required=True)
p.add_argument('--face-x', type=int, required=True)
p.add_argument('--head-scale', type=float, default=1.7)
p.add_argument('--body-scale', type=float, default=0.72)
p.add_argument('--height', type=int, default=780)
args = p.parse_args()

src = Image.open(args.src).convert('RGBA')
W, H = src.size
chin, fx = args.chin, args.face_x
feather = int(H * 0.05)
hs, bs = args.head_scale, args.body_scale

# Head: everything above the chin plus a feathered band below it.
head = src.crop((0, 0, W, chin + feather))
alpha = np.array(head.getchannel('A'), dtype=np.float32)
ramp = np.linspace(1, 0, feather)
alpha[chin:chin + feather] *= ramp[:, None]
head.putalpha(Image.fromarray(alpha.astype(np.uint8)))
head = head.resize((int(W * hs), int((chin + feather) * hs)), Image.LANCZOS)

# Body: from slightly above the chin down, shrunk.
body_top = chin - feather
body = src.crop((0, body_top, W, H))
body = body.resize((int(W * bs), int((H - body_top) * bs)), Image.LANCZOS)

# Align the chin of the big head with the neck of the small body.
head_chin = (int(fx * hs), int(chin * hs))
body_neck = (int(fx * bs), int(feather * bs))
dx = head_chin[0] - body_neck[0]
dy = head_chin[1] - body_neck[1]
left = min(0, dx)
cw = max(head.width, dx + body.width) - left
ch = max(head.height, dy + body.height)
canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
canvas.alpha_composite(body, (dx - left, dy))
canvas.alpha_composite(head, (-left, 0))
canvas = canvas.crop(canvas.getbbox())

# Cartoon finish: smooth flat colours, punchier saturation.
rgb = canvas.convert('RGB').filter(ImageFilter.MedianFilter(5))
rgb = ImageEnhance.Color(rgb).enhance(1.35)
rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
rgb = ImageOps.posterize(rgb, 5)
a = canvas.getchannel('A').point(lambda v: 255 if v > 110 else 0)

# Ink lines along strong edges.
edges = rgb.convert('L').filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 95 else 0)
edges = edges.filter(ImageFilter.MaxFilter(3))
ink = Image.new('RGB', rgb.size, (40, 30, 30))
rgb = Image.composite(ink, rgb, Image.eval(edges, lambda v: int(v * 0.55)))
figure = rgb.convert('RGBA')
figure.putalpha(a)

# Sticker border: dark outline, then a thick white rim.
pad = 40
size = (figure.width + pad * 2, figure.height + pad * 2)
mask = Image.new('L', size, 0)
mask.paste(a, (pad, pad))
white_mask = mask.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(2))
dark_mask = mask.filter(ImageFilter.MaxFilter(33)).filter(ImageFilter.GaussianBlur(2))
out = Image.new('RGBA', size, (0, 0, 0, 0))
out.paste((60, 40, 40, 255), (0, 0), dark_mask)
out.paste((255, 255, 255, 255), (0, 0), white_mask)
out.alpha_composite(figure, (pad, pad))
out = out.crop(out.getbbox())

ratio = args.height / out.height
out = out.resize((int(out.width * ratio), args.height), Image.LANCZOS)
out.save(args.out)
print(f'saved {args.out} {out.size}')
