# html2pptx

Convert browser-rendered HTML/WebDeck slide decks to editable PowerPoint PPTX.

Most HTML-to-PPTX exporters flatten slides into images. `html2pptx` tries to preserve editable DOM text, CSS boxes, SVG primitives, and ECharts vectors as native PowerPoint objects.

![html2pptx demo overview](assets/demo-overview.svg)

The pipeline renders the HTML in Chromium, extracts visible DOM/CSS/SVG/ECharts content into editable SVG primitives, then converts those SVG primitives to native PowerPoint DrawingML shapes.

GitHub: <https://github.com/GX-Alex/html2pptx>

## Features

- Editable PPTX output: text and shapes are native PowerPoint objects where possible.
- Better chart support: ECharts charts are forced to SVG renderer and exported as vector primitives.
- No full-slide screenshot fallback by default.
- Works as a Codex skill, as a Claude Code / opencode project skill, and as a plain CLI.
- Includes troubleshooting notes for blank charts, missing text, long scroll pages, and browser launch failures.

## Why It Exists

AI-generated decks and WebDeck-style presentations often start as HTML, but teams still need PowerPoint for editing, review, and sharing. Screenshot-based export looks acceptable at first, then fails when someone needs to edit a title, recolor a chart, or move a shape.

`html2pptx` is built for that gap: it favors editable PowerPoint output over opaque slide screenshots.

## Best-Fit Use Cases

Use this tool when the source HTML is already shaped like a slide deck:

- WebDeck-style documents with `.deck-slide`, `.deck-stage`, and fixed 16:9 slide pages.
- HTML presentations where each slide is designed for a 1280x720 viewport.
- Decks with DOM text, CSS boxes, SVG diagrams, and ECharts charts that should remain editable.
- Workflows where editability matters more than screenshot-level pixel perfection.

Avoid using it as the only export path when the HTML is a long webpage, a dashboard, or an article that merely happens to be embedded inside a slide container.

## Requirements

- Python 3.10+
- Node.js 18+
- Chrome or Chromium
- Python package: `python-pptx`

Install minimal dependency:

```bash
python -m pip install python-pptx
```

If you use Playwright Chromium, install Playwright separately:

```bash
python -m pip install playwright
python -m playwright install chromium
```

## Quick Start

Clone the repository and install dependencies:

```bash
git clone https://github.com/GX-Alex/html2pptx.git
cd html2pptx
python -m pip install -r requirements.txt
```

Convert a deck:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

Try the included example:

```bash
python skills/html2pptx/scripts/html2pptx.py examples/basic-deck.html -o basic-deck.pptx
```

If Chrome cannot be found:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Keep intermediate SVGs:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --workdir /tmp/html2pptx-debug --keep-workdir
```

## Use with AI Agent Tools

### Codex

Install the skill folder into Codex's skill directory:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/html2pptx "${CODEX_HOME:-$HOME/.codex}/skills/html2pptx"
```

Then ask:

```text
Use $html2pptx to convert this HTML deck into an editable PPTX.
```

Codex should read `skills/html2pptx/SKILL.md` and use the bundled scripts.

### Claude Code

The Claude Code project-skill entry point is:

```text
.claude/skills/html2pptx/SKILL.md
```

Usage:

1. Open the cloned `html2pptx` repository in Claude Code.
2. Ask Claude Code to use the `html2pptx` skill, for example:

```text
Use the html2pptx skill in this repository to convert deck.html to deck.pptx.
```

3. Claude Code reads `.claude/skills/html2pptx/SKILL.md` and calls the shared converter:

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

You can also run the CLI directly without invoking the skill.

### opencode

opencode can also discover the project skill in this repository:

```text
.claude/skills/html2pptx/SKILL.md
```

Usage:

1. Open the cloned `html2pptx` repository in opencode.
2. Ask opencode to use the `html2pptx` skill, for example:

```text
Use the html2pptx skill to convert deck.html into an editable PowerPoint file.
```

3. opencode follows `AGENTS.md` / `OPENCODE.md` and calls the same CLI wrapper:

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

In short, Claude Code and opencode use `.claude/skills/html2pptx/SKILL.md` as the project-skill entry point. The real converter remains in `skills/html2pptx` so there is only one implementation to maintain.

## Validation

Check that the PPTX is editable:

```bash
python - <<'PY'
from zipfile import ZipFile
p = "output.pptx"
with ZipFile(p) as z:
    slides = [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
    sp = sum(z.read(n).count(b"<p:sp") for n in slides)
    pic = sum(z.read(n).count(b"<p:pic") for n in slides)
print("slides", len(slides), "editable shapes", sp, "pictures", pic)
PY
```

`pictures=0` usually means no full-slide image fallback was used.

## Known Limits

- Long webpage layouts are clipped to the 1280x720 slide viewport.
- Nested full HTML documents inside slides may need preprocessing.
- CSS pseudo-elements, external icon fonts, filters, shadows, and complex masks may degrade.
- Browser launch may require `--chrome` in sandboxed environments.

## Example Failure Mode: Nested Full Pages

Some generated decks place a complete web page inside each slide, for example:

```html
<div class="deck-stage">
  <!doctype html>
  <html>
    <head>...</head>
    <body>...</body>
  </html>
</div>
```

This is not a normal slide fragment. Browsers repair this invalid DOM, and the extractor may see only part of the intended page. If the nested page is also a long `100vh`/scroll layout, content beyond the first 1280x720 viewport is clipped or appears outside the PPT slide. In these cases, preprocess the HTML into true slide fragments or split/re-layout the long page before conversion.

## Grow the Project

- Add GitHub topics from `docs/PROMOTION.md`.
- Set the repository social preview from `assets/social-preview.svg`.
- Publish the first release using `CHANGELOG.md`.
- Share the launch drafts in `docs/PROMOTION.md`.
- Use the issue templates under `.github/ISSUE_TEMPLATE/` to collect bugs, feature requests, and good-first-issue contributions.
