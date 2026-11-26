import json
import os
import glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, "assets")
COVERS_DIR = os.path.join(ASSETS_DIR, "covers")
INLINE_DIR = os.path.join(ASSETS_DIR, "inline")
CONTENT_DIR = os.path.join(ROOT, "content")

COVER_WIDTH = 480
COVER_HEIGHT = 660
INLINE_MAX_WIDTH = 1120
COVER_FOCAL_X = {"ditide-05.webp": 0.35}
RASTER_EXTS = (".webp", ".png", ".jpg", ".jpeg")


def prepare_mode(im):
    if im.mode in ("RGBA", "RGB"):
        return im
    if im.mode == "P" and "transparency" in im.info:
        return im.convert("RGBA")
    return im.convert("RGB")


def make_cover(filename):
    src = os.path.join(ASSETS_DIR, filename)
    dst = os.path.join(COVERS_DIR, filename)
    with Image.open(src) as raw:
        im = prepare_mode(raw)
        w, h = im.size
        target_ratio = COVER_WIDTH / COVER_HEIGHT
        cur_ratio = w / h
        if cur_ratio > target_ratio:
            nw = max(1, round(h * target_ratio))
            fx = COVER_FOCAL_X.get(filename, 0.5)
            left = max(0, min(w - nw, round((w - nw) * fx)))
            im = im.crop((left, 0, left + nw, h))
        elif cur_ratio < target_ratio:
            nh = max(1, round(w / target_ratio))
            top = max(0, (h - nh) // 2)
            im = im.crop((0, top, w, top + nh))
        im = im.resize((COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS)
        im.save(dst, format="WEBP", quality=80, method=6)
    return os.path.getsize(src), os.path.getsize(dst)


def make_inline(filename):
    src = os.path.join(ASSETS_DIR, filename)
    dst = os.path.join(INLINE_DIR, filename)
    with Image.open(src) as raw:
        im = prepare_mode(raw)
        w, h = im.size
        if w > INLINE_MAX_WIDTH:
            nh = max(1, round(h * INLINE_MAX_WIDTH / w))
            im = im.resize((INLINE_MAX_WIDTH, nh), Image.Resampling.LANCZOS)
        im.save(dst, format="WEBP", quality=76, method=6)
    return os.path.getsize(src), os.path.getsize(dst)


def main():
    os.makedirs(COVERS_DIR, exist_ok=True)
    os.makedirs(INLINE_DIR, exist_ok=True)

    covers = set()
    scenes = set()
    for book_path in sorted(glob.glob(os.path.join(CONTENT_DIR, "*", "book.json"))):
        with open(book_path, "r", encoding="utf-8-sig") as f:
            book = json.load(f)
        cover = book.get("cover", "")
        if cover.lower().endswith(RASTER_EXTS):
            covers.add(cover)
        for img_name in book.get("images", {}):
            if img_name.lower().endswith(RASTER_EXTS):
                scenes.add(img_name)

    cover_orig, cover_new = 0, 0
    for name in sorted(covers):
        s_old, s_new = make_cover(name)
        cover_orig += s_old
        cover_new += s_new
        print(f"cover {name}: {s_old / 1024:.1f} KB -> {s_new / 1024:.1f} KB")

    scene_orig, scene_new = 0, 0
    for name in sorted(scenes):
        s_old, s_new = make_inline(name)
        scene_orig += s_old
        scene_new += s_new

    print(
        f"Summary: covers={len(covers)} ({cover_orig / 1024:.1f} KB -> {cover_new / 1024:.1f} KB), "
        f"inline={len(scenes)} ({scene_orig / 1024:.1f} KB -> {scene_new / 1024:.1f} KB)"
    )


if __name__ == "__main__":
    main()
