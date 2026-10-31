import math, os, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
SS = 4
BG = (13, 18, 21, 255)

def gauge(size, safe):
    """Gambar busur spidometer 240 derajat hijau-kuning-merah, transparan di belakang."""
    S = size * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = S / 2
    r = S * safe / 2 * 0.80
    w = S * safe * 0.13
    box = [cx - r, cy - r, cx + r, cy + r]
    # PIL: sudut 0 = jam 3, searah jarum jam. Mulai 150 derajat, sapuan 240.
    segs = [(150, 150 + 240 * 0.50, (63, 208, 122, 255)), (150 + 240 * 0.50, 150 + 240 * 0.75, (245, 197, 24, 255)), (150 + 240 * 0.75, 390, (255, 91, 80, 255))]
    for a0, a1, c in segs:
        d.arc(box, a0, a1, fill=c, width=int(w))
    # jarum
    ang = math.radians(150 + 240 * 0.62)
    x1 = cx + r * 0.78 * math.cos(ang)
    y1 = cy + r * 0.78 * math.sin(ang)
    d.line([cx, cy, x1, y1], fill=(234, 240, 242, 255), width=int(w * 0.45))
    d.ellipse([cx - w * 0.55, cy - w * 0.55, cx + w * 0.55, cy + w * 0.55], fill=(234, 240, 242, 255))
    return im.resize((size, size), Image.LANCZOS)

def full(size, round_):
    base = Image.new('RGBA', (size, size), BG)
    g = gauge(size, 0.80)
    base.alpha_composite(g)
    if round_:
        m = Image.new('L', (size * SS, size * SS), 0)
        ImageDraw.Draw(m).ellipse([0, 0, size * SS - 1, size * SS - 1], fill=255)
        m = m.resize((size, size), Image.LANCZOS)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(base, (0, 0), m)
        return out
    return base

DENS = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for name, px in DENS.items():
    d = os.path.join(OUT, 'mipmap-' + name)
    os.makedirs(d, exist_ok=True)
    full(px, False).save(os.path.join(d, 'ic_launcher.png'))
    full(px, True).save(os.path.join(d, 'ic_launcher_round.png'))
    fg = px * 108 // 48
    gauge(fg, 0.62).save(os.path.join(d, 'ic_launcher_foreground.png'))
print('ikon selesai')
