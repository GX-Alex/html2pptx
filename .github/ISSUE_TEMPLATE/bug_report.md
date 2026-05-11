---
name: Bug report
about: Report a conversion problem or broken output
title: "[Bug]: "
labels: bug
assignees: ""
---

## What happened?

Describe the conversion problem.

## Input deck

- Is the source a fixed 16:9 slide deck, a WebDeck document, or a long webpage?
- Does it use ECharts, SVG, external fonts, or nested full HTML documents?

## Command

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

## Debug output

If possible, rerun with:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --workdir /tmp/html2pptx-debug --keep-workdir
```

Then attach or describe the affected `svg_output/NN_slide.svg`.

## Environment

- OS:
- Python version:
- Node.js version:
- Chrome/Chromium version:
