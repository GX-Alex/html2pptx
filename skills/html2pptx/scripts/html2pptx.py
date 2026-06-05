#!/usr/bin/env python3
"""Convert an HTML/WebDeck slide deck to editable PPTX.

This wrapper runs:
  HTML DOM/CSS layout -> editable SVG primitives -> native DrawingML PPTX
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

SCRIPT_DIR = Path(__file__).resolve().parent
HTML_TO_SVG = SCRIPT_DIR / "html_dom_to_editable_svg.js"
sys.path.insert(0, str(SCRIPT_DIR))

from svg_to_pptx import create_pptx_with_native_svg  # noqa: E402


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
    )
    parser.add_argument("input_html", type=Path, help="Input HTML deck path")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output .pptx path")
    parser.add_argument("--workdir", type=Path, default=None, help="Intermediate project directory")
    parser.add_argument("--keep-workdir", action="store_true", help="Keep intermediate SVG project")
    parser.add_argument("--chrome", type=Path, default=None, help="Chrome/Chromium executable path")
    parser.add_argument("--canvas-format", default="ppt169", help="ppt-master canvas format")
    parser.add_argument("--quiet", action="store_true", help="Reduce output")
    return parser.parse_args()


def html_needs_deck_wrapper(html: str) -> bool:
    return not re.search(r'class=["\'][^"\']*\bdeck-slide\b', html)


def wrap_html_as_single_slide(input_html: Path, temp_root: Path) -> Path:
    html = input_html.read_text(encoding="utf-8", errors="replace")
    if not html_needs_deck_wrapper(html):
        return input_html

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

    wrapped = temp_root / f"{input_html.stem}.html2pptx-wrapped.html"
    wrapped.write_text(html, encoding="utf-8")
    return wrapped


def read_notes(notes_dir: Path) -> dict[str, str]:
    notes: dict[str, str] = {}
    if not notes_dir.exists():
        return notes
    for path in notes_dir.glob("*.md"):
        if path.name == "total.md":
            continue
        notes[path.stem] = path.read_text(encoding="utf-8", errors="replace")
    return notes


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

    try:
        extraction_html = wrap_html_as_single_slide(input_html, temp_root)
        cmd = ["node", str(HTML_TO_SVG), str(extraction_html), str(project_dir)]
        if not args.quiet:
            print("[html2pptx] Extracting editable SVG with Chromium...", flush=True)
            if extraction_html != input_html:
                print("[html2pptx] Auto-wrapped non-WebDeck HTML as a single slide.", flush=True)
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
