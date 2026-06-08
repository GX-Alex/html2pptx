#!/usr/bin/env python3
"""Convert an HTML/WebDeck slide deck to editable PPTX.

This wrapper runs:
  HTML DOM/CSS layout -> editable SVG primitives -> native DrawingML PPTX
"""
from __future__ import annotations

import argparse
from html import escape as html_escape
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from shutil import which
from zipfile import ZipFile

SCRIPT_DIR = Path(__file__).resolve().parent
HTML_TO_SVG = SCRIPT_DIR / "html_dom_to_editable_svg.js"
sys.path.insert(0, str(SCRIPT_DIR))

from svg_to_pptx import create_pptx_with_native_svg  # noqa: E402
from fontawesome_subset import FA_SOLID_ICONS  # noqa: E402


FONTAWESOME_INLINE_STYLE = """
<style id="html2pptx-fontawesome-inline-svg">
  .fa-inline-svg {
    display: inline-block !important;
    width: 1em !important;
    height: 1em !important;
    vertical-align: -0.125em !important;
    color: inherit;
    fill: currentColor;
    flex: none !important;
  }
  .fa-inline-svg path {
    fill: currentColor;
  }
</style>
"""


AUTO_WRAP_STYLE = """
<style id="html2pptx-auto-deck-wrapper">
  html, body {
    width: 1280px !important;
    height: 720px !important;
    min-height: 720px !important;
    margin: 0 !important;
    overflow: hidden !important;
  }
  #slides-container {
    width: 1280px !important;
    height: 720px !important;
    position: relative !important;
    overflow: hidden !important;
  }
  .deck-slide {
    width: 1280px !important;
    height: 720px !important;
    display: block !important;
    position: relative !important;
    overflow: hidden !important;
  }
  .deck-stage {
    width: 1280px !important;
    height: 720px !important;
    position: relative !important;
    overflow: hidden !important;
    transform: none !important;
  }
  .deck-page {
    width: 1280px !important;
    height: 720px !important;
    position: relative !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
</style>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a WebDeck-style HTML presentation to editable PPTX.",
        epilog=(
            "Examples:\n"
            "  python skills/html2pptx/scripts/html2pptx.py examples/basic-deck.html -o basic-deck.pptx\n"
            "  python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx --chrome \"C:/Program Files/Google/Chrome/Application/chrome.exe\"\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("input_html", type=Path, help="Input HTML deck path")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output .pptx path")
    parser.add_argument("--workdir", type=Path, default=None, help="Intermediate project directory")
    parser.add_argument("--keep-workdir", action="store_true", help="Keep intermediate SVG project")
    parser.add_argument(
        "--chrome",
        "--chrome-path",
        dest="chrome",
        type=Path,
        default=None,
        help="Chrome/Chromium executable path; --chrome-path is accepted as an alias",
    )
    parser.add_argument("--canvas-format", default="ppt169", help="ppt-master canvas format")
    parser.add_argument("--quiet", action="store_true", help="Reduce output")
    return parser.parse_args()


def html_needs_deck_wrapper(html: str) -> bool:
    return not re.search(r'class=["\'][^"\']*\bdeck-slide\b', html)


def fontawesome_icon_name(classes: str) -> str | None:
    ignored = {
        "fa",
        "fas",
        "far",
        "fab",
        "fal",
        "fad",
        "fa-solid",
        "fa-regular",
        "fa-brands",
        "fa-fw",
        "fa-lg",
        "fa-xs",
        "fa-sm",
        "fa-1x",
        "fa-2x",
        "fa-3x",
        "fa-4x",
        "fa-5x",
        "fa-6x",
        "fa-7x",
        "fa-8x",
        "fa-9x",
        "fa-10x",
    }
    for cls in classes.split():
        if cls.startswith("fa-") and cls not in ignored:
            return cls.removeprefix("fa-")
    return None


def inline_fontawesome_icons(html: str) -> tuple[str, int]:
    count = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal count
        attrs = match.group(1)
        class_match = re.search(r'\bclass\s*=\s*(["\'])(.*?)\1', attrs, flags=re.IGNORECASE | re.DOTALL)
        if not class_match:
            return match.group(0)
        classes = class_match.group(2)
        icon_name = fontawesome_icon_name(classes)
        icon = FA_SOLID_ICONS.get(icon_name or "")
        if not icon:
            return match.group(0)

        style_match = re.search(r'\bstyle\s*=\s*(["\'])(.*?)\1', attrs, flags=re.IGNORECASE | re.DOTALL)
        style = style_match.group(2) if style_match else ""
        width, height, path_data = icon
        count += 1
        return (
            f'<svg class="fa-inline-svg {html_escape(classes, quote=True)}" '
            f'viewBox="0 0 {width} {height}" aria-hidden="true" focusable="false" '
            f'style="{html_escape(style, quote=True)};overflow:visible;">'
            f'<path fill="currentColor" d="{html_escape(path_data, quote=True)}"></path>'
            f"</svg>"
        )

    next_html = re.sub(r"<i\b([^>]*)>\s*</i>", repl, html, flags=re.IGNORECASE | re.DOTALL)
    if count:
        next_html = re.sub(
            r"<link\b[^>]*(?:font-awesome|fontawesome)[^>]*>",
            "",
            next_html,
            flags=re.IGNORECASE,
        )
        next_html = re.sub(r"</head\s*>", FONTAWESOME_INLINE_STYLE + "\n</head>", next_html, count=1, flags=re.IGNORECASE)
    return next_html, count


def preprocess_html(input_html: Path, temp_root: Path) -> tuple[Path, dict[str, int | bool]]:
    html = input_html.read_text(encoding="utf-8", errors="replace")
    html, icon_count = inline_fontawesome_icons(html)
    needs_wrapper = html_needs_deck_wrapper(html)

    if needs_wrapper:
        html = re.sub(r"</head\s*>", AUTO_WRAP_STYLE + "\n</head>", html, count=1, flags=re.IGNORECASE)
        html = re.sub(
            r"<body([^>]*)>",
            r'<body\1><div id="slides-container"><div class="deck-slide active"><div class="deck-stage"><section class="deck-page" data-page-id="p01">',
            html,
            count=1,
            flags=re.IGNORECASE,
        )
        html = re.sub(
            r"</body\s*>",
            r"</section></div></div></div></body>",
            html,
            count=1,
            flags=re.IGNORECASE,
        )

    if not needs_wrapper and not icon_count:
        return input_html, {"wrapped": False, "fontawesome_icons": 0}

    preprocessed = temp_root / f"{input_html.stem}.html2pptx-preprocessed.html"
    preprocessed.write_text(html, encoding="utf-8")
    return preprocessed, {"wrapped": needs_wrapper, "fontawesome_icons": icon_count}


def read_notes(notes_dir: Path) -> dict[str, str]:
    notes: dict[str, str] = {}
    if not notes_dir.exists():
        return notes
    for path in notes_dir.glob("*.md"):
        if path.name == "total.md":
            continue
        notes[path.stem] = path.read_text(encoding="utf-8", errors="replace")
    return notes


def chrome_candidates() -> list[Path]:
    candidates: list[Path] = []

    env_chrome = os.environ.get("CHROME")
    if env_chrome:
        candidates.append(Path(env_chrome))

    for name in ("chrome", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "msedge"):
        found = which(name)
        if found:
            candidates.append(Path(found))

    if sys.platform == "darwin":
        candidates.extend([
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
        ])
    elif sys.platform.startswith("win"):
        program_files = [
            os.environ.get("PROGRAMFILES"),
            os.environ.get("PROGRAMFILES(X86)"),
            os.environ.get("LOCALAPPDATA"),
        ]
        for root in [Path(p) for p in program_files if p]:
            candidates.extend([
                root / "Google" / "Chrome" / "Application" / "chrome.exe",
                root / "Chromium" / "Application" / "chrome.exe",
                root / "Microsoft" / "Edge" / "Application" / "msedge.exe",
            ])
    else:
        candidates.extend([
            Path("/usr/bin/google-chrome"),
            Path("/usr/bin/google-chrome-stable"),
            Path("/usr/bin/chromium"),
            Path("/usr/bin/chromium-browser"),
            Path("/snap/bin/chromium"),
            Path("/usr/bin/microsoft-edge"),
        ])

    seen: set[str] = set()
    unique: list[Path] = []
    for path in candidates:
        key = os.path.normcase(str(path))
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def discover_chrome() -> Path | None:
    for path in chrome_candidates():
        try:
            expanded = path.expanduser()
            if expanded.exists():
                return expanded.resolve()
        except OSError:
            continue
    return None


def summarize_pptx(path: Path) -> dict[str, int]:
    with ZipFile(path) as zf:
        slides = [
            name for name in zf.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        ]
        sp = grp = pic = 0
        for slide in slides:
            xml = zf.read(slide)
            sp += xml.count(b"<p:sp")
            grp += xml.count(b"<p:grpSp")
            pic += xml.count(b"<p:pic")
    return {"slides": len(slides), "shapes": sp, "groups": grp, "pictures": pic}


def main() -> int:
    args = parse_args()
    input_html = args.input_html.expanduser().resolve()
    output = args.output.expanduser().resolve()

    if not input_html.exists():
        print(f"Input HTML not found: {input_html}", file=sys.stderr)
        print(
            "Tip: run the included smoke test first:\n"
            "  python skills/html2pptx/scripts/html2pptx.py examples/basic-deck.html -o basic-deck.pptx",
            file=sys.stderr,
        )
        return 2
    if input_html.suffix.lower() not in {".html", ".htm"}:
        print(f"Input does not look like HTML: {input_html}", file=sys.stderr)
        return 2

    temp_root: Path | None = None
    if args.workdir:
        project_dir = args.workdir.expanduser().resolve()
        temp_root = Path(tempfile.mkdtemp(prefix="html2pptx-preprocess-"))
    else:
        temp_root = Path(tempfile.mkdtemp(prefix="html2pptx-"))
        project_dir = temp_root / "project"

    env = dict(os.environ)
    if args.chrome:
        env["CHROME"] = str(args.chrome.expanduser().resolve())
    elif "CHROME" not in env:
        discovered_chrome = discover_chrome()
        if discovered_chrome:
            env["CHROME"] = str(discovered_chrome)

    try:
        extraction_html, preprocess_stats = preprocess_html(input_html, temp_root)
        cmd = ["node", str(HTML_TO_SVG), str(extraction_html), str(project_dir)]
        if not args.quiet:
            print("[html2pptx] Extracting editable SVG with Chromium...", flush=True)
            if preprocess_stats["wrapped"]:
                print("[html2pptx] Auto-wrapped non-WebDeck HTML as a single slide.", flush=True)
            if preprocess_stats["fontawesome_icons"]:
                print(
                    f"[html2pptx] Inlined {preprocess_stats['fontawesome_icons']} Font Awesome icons as SVG.",
                    flush=True,
                )
        subprocess.run(cmd, check=True, env=env)

        svg_files = sorted((project_dir / "svg_output").glob("*.svg"))
        if not svg_files:
            print("No SVG slides were generated.", file=sys.stderr)
            return 1

        output.parent.mkdir(parents=True, exist_ok=True)
        ok = create_pptx_with_native_svg(
            svg_files=svg_files,
            output_path=output,
            canvas_format=args.canvas_format,
            verbose=not args.quiet,
            transition=None,
            use_compat_mode=False,
            notes=read_notes(project_dir / "notes"),
            enable_notes=True,
            use_native_shapes=True,
            animation=None,
        )
        if not ok or not output.exists():
            print("PPTX conversion failed.", file=sys.stderr)
            return 1

        summary = summarize_pptx(output)
        if not args.quiet:
            print(
                "[html2pptx] Done: "
                f"{output} ({summary['slides']} slides, "
                f"{summary['shapes']} shapes, {summary['pictures']} pictures)"
            )
        return 0
    finally:
        if args.workdir and temp_root:
            shutil.rmtree(temp_root, ignore_errors=True)
        elif temp_root and not args.keep_workdir:
            shutil.rmtree(temp_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
