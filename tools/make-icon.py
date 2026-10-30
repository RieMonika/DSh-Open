# -*- coding: utf-8 -*-
"""
生成 DSh Open 的图标：Q 版鲸鱼娘（DeepSeek 蓝）。
输出：
    app/assets/icon.ico   (16/24/32/48/64/128/256 多尺寸)
    app/assets/icon.png   (512, 界面用)

纯 PIL 绘制，不依赖任何外部素材。
"""

import os
import math
from PIL import Image, ImageDraw

S = 1024          # 逻辑画布
SS = 4            # 超采样倍数
C = S * SS        # 实际画布

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'assets')


def sc(v):
    """逻辑坐标 -> 实际坐标"""
    return int(round(v * SS))


def lerp(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


# ---------------------------------------------------------------- 调色板
BLUE_TOP = (94, 128, 255)     # 渐变浅
BLUE_BOT = (56, 84, 235)      # 渐变深
WHALE = (255, 255, 255)       # 鲸鱼主体
BELLY = (214, 227, 255)       # 肚皮
EYE = (23, 35, 80)            # 眼睛
BLUSH = (255, 158, 190, 210)  # 腮红
BOW = (255, 122, 165)         # 蝴蝶结
SPOUT = (207, 224, 255)       # 喷水


def rounded_gradient(size, radius):
    """圆角矩形 + 垂直渐变背景"""
    w = h = size
    grad = Image.new('RGB', (1, h))
    px = grad.load()
    for y in range(h):
        px[0, y] = lerp(BLUE_TOP, BLUE_BOT, y / (h - 1))
    grad = grad.resize((w, h))

    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)

    bg = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bg.paste(grad, (0, 0), mask)
    return bg


def ellipse_rot(draw_target, box, angle, fill):
    """画一个旋转过的椭圆（在同一图层上合成）"""
    x0, y0, x1, y1 = [sc(v) for v in box]
    w, h = x1 - x0, y1 - y0
    d = int(math.hypot(w, h)) + 4
    layer = Image.new('RGBA', (d, d), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([(d - w) / 2, (d - h) / 2, (d + w) / 2, (d + h) / 2], fill=fill)
    layer = layer.rotate(angle, resample=Image.BICUBIC, expand=False)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    draw_target.alpha_composite(layer, (cx - d // 2, cy - d // 2))


def bez(p0, p1, p2, n=48):
    """二次贝塞尔采样点（逻辑坐标 -> 实际坐标）"""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((sc(x), sc(y)))
    return pts


def build():
    img = rounded_gradient(C, sc(228))
    layer = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # ---------------- 喷水（在鲸鱼身后）
    for cx, cy, r in [(340, 300, 26), (378, 258, 20), (318, 258, 18), (350, 214, 13)]:
        d.ellipse([sc(cx - r), sc(cy - r), sc(cx + r), sc(cy + r)], fill=SPOUT)

    # ---------------- 尾柄 + 尾鳍（先尾柄把身体和尾鳍连起来）
    # ---------------- 尾鳍（一条完整轮廓：上缘 → 尖端 → 凹口 → 下尖端 → 下缘）
    tail = (
        bez((648, 556), (818, 418), (1002, 388))
        + bez((1002, 388), (1014, 468), (870, 590))
        + bez((870, 590), (1014, 714), (1002, 792))
        + bez((1002, 792), (818, 812), (648, 644))
    )
    d.polygon(tail, fill=WHALE)

    # ---------------- 身体
    body_box = (168, 372, 772, 812)
    d.ellipse([sc(v) for v in body_box], fill=WHALE)

    # ---------------- 胸鳍
    ellipse_rot(layer, (430, 700, 640, 800), 14, (232, 241, 255))

    # ---------------- 肚皮（用身体轮廓裁一次）
    belly = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    ImageDraw.Draw(belly).ellipse(
        [sc(232), sc(616), sc(716), sc(846)], fill=BELLY + (255,)
    )
    body_mask = Image.new('L', (C, C), 0)
    ImageDraw.Draw(body_mask).ellipse([sc(v) for v in body_box], fill=255)
    belly.putalpha(Image.composite(belly.getchannel('A'), Image.new('L', (C, C), 0), body_mask))
    layer.alpha_composite(belly)

    # ---------------- 腮红
    blush = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    ImageDraw.Draw(blush).ellipse([sc(236), sc(596), sc(330), sc(652)], fill=BLUSH)
    layer.alpha_composite(blush)

    # ---------------- 眼睛
    e = ImageDraw.Draw(layer)
    e.ellipse([sc(312), sc(492), sc(400), sc(580)], fill=EYE)          # 眼珠
    e.ellipse([sc(336), sc(508), sc(368), sc(540)], fill=(255, 255, 255))  # 高光
    # 睫毛（从眼睛上部斜向外挑）
    for x1, y1, x2, y2 in [(346, 500, 330, 478), (362, 494, 354, 472), (379, 496, 383, 476)]:
        e.line([sc(x1), sc(y1), sc(x2), sc(y2)], fill=EYE, width=sc(11))

    # ---------------- 微笑
    e.arc([sc(300), sc(612), sc(474), sc(716)], start=18, end=162,
          fill=(150, 172, 226), width=sc(11))

    # ---------------- 蝴蝶结（头顶）
    bow_y, bow_x = 392, 392
    e.polygon([[sc(bow_x - 6), sc(bow_y)], [sc(bow_x - 92), sc(bow_y - 44)],
               [sc(bow_x - 92), sc(bow_y + 40)]], fill=BOW)
    e.polygon([[sc(bow_x + 6), sc(bow_y)], [sc(bow_x + 92), sc(bow_y - 44)],
               [sc(bow_x + 92), sc(bow_y + 40)]], fill=BOW)
    e.ellipse([sc(bow_x - 20), sc(bow_y - 20), sc(bow_x + 20), sc(bow_y + 20)],
              fill=(255, 150, 186))

    # ---------------- 自动居中 + 留白（角色整体缩放到画布内，避免尾巴贴边）
    bbox = layer.getbbox()
    pad = int(C * 0.085)
    scale = min(
        (C - 2 * pad) / (bbox[2] - bbox[0]),
        (C - 2 * pad) / (bbox[3] - bbox[1]),
        1.0,
    )
    cropped = layer.crop(bbox)
    cropped = cropped.resize(
        (max(1, int(cropped.width * scale)), max(1, int(cropped.height * scale))),
        Image.LANCZOS,
    )
    centered = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    centered.alpha_composite(cropped, ((C - cropped.width) // 2, (C - cropped.height) // 2))
    img.alpha_composite(centered)

    # ---------------- 输出
    os.makedirs(OUT_DIR, exist_ok=True)
    flat = img.resize((S, S), Image.LANCZOS)

    png_path = os.path.join(OUT_DIR, 'icon.png')
    flat.save(png_path)
    flat.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT_DIR, 'icon-512.png'))

    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    flat.save(ico_path, format='ICO',
              sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)])

    print('OK ->', png_path)
    print('OK ->', ico_path)


if __name__ == '__main__':
    build()
