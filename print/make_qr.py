"""Branded IFRS QR code generator.

Outputs qr.svg (vector, for print) and qr.png (raster), and verifies the PNG decodes.
Usage: python3 make_qr.py [URL] [--dot=0.28] [--finder=1.3] [--logo=0.24]
"""
import sys
import segno
from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=') for a in sys.argv[1:] if a.startswith('--'))
URL = args[0] if args else 'https://isaacalberto.github.io/ifrs/'
DOT_R = float(opts.get('dot', 0.28))      # module corner radius (fraction of module)
FIND_R = float(opts.get('finder', 1.3))   # finder outer corner radius (modules)
LOGO = float(opts.get('logo', 0.24))      # logo width as fraction of symbol
OUT = opts.get('out', 'qr')

NAVY, NAVY2, TEAL_D, TEAL, AQUA = '#0b2545', '#13315c', '#0f766e', '#1fa597', '#2ec4b6'

qr = segno.make(URL, error='h', boost_error=False)
m = [list(r) for r in qr.matrix]
n = len(m)
Q, S = 4, 10
size = (n + 2 * Q) * S
cut = max(0, int(n * LOGO)) | 1 if LOGO > 0 else 0
c0 = (n - cut) // 2


def finder(r, c):
    return (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)


def in_logo(r, c):
    return cut and c0 <= r < c0 + cut and c0 <= c < c0 + cut


def lerp(a, b, t):
    a = tuple(int(a[i:i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(b[i:i + 2], 16) for i in (1, 3, 5))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grad(x, y):
    t = (x + y) / (2 * size)
    return lerp(NAVY, NAVY2, t / 0.55) if t < 0.55 else lerp(NAVY2, TEAL_D, (t - 0.55) / 0.45)


modules = [(r, c) for r in range(n) for c in range(n) if m[r][c] and not finder(r, c) and not in_logo(r, c)]
eyes = [(0, 0), (0, n - 7), (n - 7, 0)]

# ---------- SVG ----------
p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">',
     f'<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{size}" y2="{size}"><stop offset="0" stop-color="{NAVY}"/><stop offset=".55" stop-color="{NAVY2}"/><stop offset="1" stop-color="{TEAL_D}"/></linearGradient></defs>',
     f'<rect width="{size}" height="{size}" rx="{S * 3}" fill="#fff"/>', '<g fill="url(#g)">']
w = S * 0.92
for r, c in modules:
    x, y = (c + Q) * S + S * 0.04, (r + Q) * S + S * 0.04
    p.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{w:.1f}" rx="{S * DOT_R:.1f}"/>')
p.append('</g>')
for r, c in eyes:
    x, y = (c + Q) * S, (r + Q) * S
    p.append(f'<rect x="{x + S * .5}" y="{y + S * .5}" width="{S * 6}" height="{S * 6}" rx="{S * FIND_R}" fill="none" stroke="{NAVY}" stroke-width="{S}"/>')
    p.append(f'<rect x="{x + S * 2}" y="{y + S * 2}" width="{S * 3}" height="{S * 3}" rx="{S * FIND_R * 0.45}" fill="{TEAL_D}"/>')
if cut:
    lx, ls, pad = (c0 + Q) * S, cut * S, S * 0.6
    k = (ls - 2 * pad) / 64
    p.append(f'<rect x="{lx + pad}" y="{lx + pad}" width="{ls - 2 * pad}" height="{ls - 2 * pad}" rx="{S * 2.2}" fill="{AQUA}"/>')
    p.append(f'<g transform="translate({lx + pad} {lx + pad}) scale({k:.4f})">'
             f'<path d="M32 9c8.5 11.5 14.5 18.5 14.5 27a14.5 14.5 0 0 1-29 0C17.5 27.5 23.5 20.5 32 9z" fill="{NAVY}"/>'
             '<path d="M12 45c4.2 0 4.2-3.2 9.3-3.2s5.1 3.2 9.4 3.2 4.2-3.2 9.3-3.2 5.1 3.2 9.4 3.2 3-1.6 4.6-2.4" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round"/>'
             f'<path d="M28 25c-2.7 3.8-4 6.8-4 9.5" stroke="{AQUA}" stroke-width="3" fill="none" stroke-linecap="round"/></g>')
p.append('</svg>')
open(f'{OUT}.svg', 'w').write(''.join(p))

# ---------- PNG (supersampled raster with identical geometry, logo simplified) ----------
SS = 4
img = Image.new('RGB', (size * SS, size * SS), 'white')
d = ImageDraw.Draw(img)
for r, c in modules:
    x, y = ((c + Q) * S + S * 0.04) * SS, ((r + Q) * S + S * 0.04) * SS
    d.rounded_rectangle([x, y, x + w * SS, y + w * SS], radius=S * DOT_R * SS, fill=grad(x / SS, y / SS))
for r, c in eyes:
    x, y = (c + Q) * S * SS, (r + Q) * S * SS
    d.rounded_rectangle([x, y, x + 7 * S * SS, y + 7 * S * SS], radius=(FIND_R + 0.5) * S * SS, fill=NAVY)
    d.rounded_rectangle([x + S * SS, y + S * SS, x + 6 * S * SS, y + 6 * S * SS], radius=max(0, FIND_R - 0.5) * S * SS, fill='white')
    d.rounded_rectangle([x + 2 * S * SS, y + 2 * S * SS, x + 5 * S * SS, y + 5 * S * SS], radius=FIND_R * 0.45 * S * SS, fill=TEAL_D)
if cut:
    lx, ls, pad = (c0 + Q) * S, cut * S, S * 0.6
    d.rounded_rectangle([(lx + pad) * SS, (lx + pad) * SS, (lx + ls - pad) * SS, (lx + ls - pad) * SS], radius=S * 2.2 * SS, fill=AQUA)
    cx = (lx + ls / 2) * SS
    rr = (ls - 2 * pad) * 0.22 * SS
    d.ellipse([cx - rr, cx - rr * 0.6, cx + rr, cx + rr * 1.4], fill=NAVY)
    d.polygon([(cx, cx - rr * 2.1), (cx - rr * 0.95, cx), (cx + rr * 0.95, cx)], fill=NAVY)
img = img.resize((size * 2, size * 2), Image.LANCZOS)
img.save(f'{OUT}.png')

import cv2
im = cv2.imread(f'{OUT}.png')
ok_std = cv2.QRCodeDetector().detectAndDecode(im)[0] == URL
ok_wc = cv2.wechat_qrcode_WeChatQRCode().detectAndDecode(im)[0] == (URL,)
small = cv2.resize(im, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
ok_small = cv2.QRCodeDetector().detectAndDecode(small)[0] == URL
print(f'v{qr.version} n={n} logo={cut}x{cut} dot={DOT_R} finder={FIND_R} | opencv={ok_std} opencv_small={ok_small} wechat={ok_wc}')
