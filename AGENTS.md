# Agent Instructions

Use the bundled `html2pptx` skill to convert HTML/WebDeck slide decks into editable PPTX.

Preferred command:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

Expected inputs:

- A local `.html` or `.htm` presentation file.
- Best results come from fixed 16:9 slide decks such as WebDeck pages with `.deck-slide` / `.deck-stage`.
- Long webpages, dashboards, or nested full HTML documents may need preprocessing before conversion.

Expected output:

- A `.pptx` file with PowerPoint-native text boxes and vector shapes where possible.
- ECharts content should remain vector/editable when the chart can be rendered as SVG.
- The result is intended to be editable, not screenshot-perfect.

When browser launch fails, locate Chrome/Chromium and pass `--chrome`.

When investigating bad pages, rerun with:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --workdir /tmp/html2pptx-debug --keep-workdir
```

Then inspect `svg_output/NN_slide.svg`.

Quality checks:

- Open the PPTX and inspect pages with charts, dense tables, and styled text.
- A successful editable export usually reports many shapes and few or no pictures.
- If a page is mostly blank, inspect the intermediate SVG first; if the SVG is also blank, the issue is in DOM extraction/browser rendering.
- If the SVG looks correct but PPTX is wrong, the issue is usually in SVG-to-DrawingML conversion.
