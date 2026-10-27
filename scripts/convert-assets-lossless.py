"""Losslessly replace PNG assets, verify every RGBA byte, then rewrite references.

Run on a clean checkout: python scripts/convert-assets-lossless.py --apply
Originals remain recoverable in git history. No resizing or quantization is used.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    sources = sorted((ROOT / 'assets').rglob('*.png'))
    if not sources:
        print('No PNG assets remain. Nothing changed.')
        return
    with tempfile.TemporaryDirectory(prefix='tree-lossless-all-') as tmp:
        def convert(source):
            relative = source.relative_to(ROOT).as_posix()
            destination = Path(tmp) / relative.replace('.png', '.webp')
            destination.parent.mkdir(parents=True, exist_ok=True)
            target = source.with_suffix('.webp')
            if target.exists():
                raise RuntimeError(f'Refusing to overwrite existing asset: {target}')
            with Image.open(source) as image:
                if image.info.get('gamma') is not None:
                    raise RuntimeError(f'Gamma metadata requires a separate color review: {relative}')
                rgba = image.convert('RGBA')
                metadata = {k: image.info[k] for k in ('icc_profile', 'exif') if image.info.get(k)}
                rgba.save(destination, 'WEBP', lossless=True, exact=True, quality=80, method=4, **metadata)
                with Image.open(destination) as decoded:
                    if rgba.size != decoded.size or rgba.tobytes() != decoded.convert('RGBA').tobytes():
                        raise RuntimeError(f'Pixel or alpha mismatch: {relative}')
                    for key, value in metadata.items():
                        if decoded.info.get(key) != value:
                            raise RuntimeError(f'Color metadata mismatch: {relative}')
                result = dict(source=relative, target=target.relative_to(ROOT).as_posix(),
                    width=rgba.width, height=rgba.height, original_bytes=source.stat().st_size,
                    webp_bytes=destination.stat().st_size, rgba_identical=True,
                    rgba_sha256=hashlib.sha256(rgba.tobytes()).hexdigest())
                print(f'{relative}: {result["original_bytes"]} -> {result["webp_bytes"]}, RGBA identical', flush=True)
                return result, destination

        with ThreadPoolExecutor(max_workers=2) as pool:
            converted = list(pool.map(convert, sources))
        results = [r for r, _ in converted]
        report = dict(pillow=pillow_version, count=len(results),
            original_bytes=sum(r['original_bytes'] for r in results),
            webp_bytes=sum(r['webp_bytes'] for r in results), assets=results)
        print(json.dumps({k: v for k, v in report.items() if k != 'assets'}), flush=True)
        if not args.apply:
            return
        # Apply only after every image passes, including fully transparent RGB pixels.
        replacements = {r['source']: r['target'] for r in results}
        tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
        text_suffixes = {'.js', '.mjs', '.ts', '.html', '.css', '.json', '.md', '.py'}
        for name in tracked:
            path = ROOT / name
            if not name or path.suffix not in text_suffixes or path.resolve() == Path(__file__).resolve():
                continue
            try:
                original = path.read_text(encoding='utf-8')
            except (UnicodeError, FileNotFoundError):
                continue
            updated = original
            for old, new in replacements.items():
                updated = updated.replace(old, new)
            # Old five-color slot renderers also contain template-literal paths.
            updated = re.sub(r'(assets/trees/tree-[^\s\x27\x22`]+)\.png', r'\1.webp', updated)
            if updated != original:
                path.write_text(updated, encoding='utf-8')
        for result, destination in converted:
            (ROOT / result['target']).write_bytes(destination.read_bytes())
            (ROOT / result['source']).unlink()
        (ROOT / 'docs/lossless-assets.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
