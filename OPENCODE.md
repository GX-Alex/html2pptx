# opencode Instructions

For HTML to editable PPTX conversion, use this repository when the input is a local HTML/WebDeck-style slide deck.

Run:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

The conversion requires Python, Node.js, and Chrome/Chromium. If the browser path is not autodetected, pass `--chrome`.

The output should favor editability over exact screenshots: text, boxes, lines, SVG, and ECharts should become native PowerPoint elements where possible.

Use `skills/html2pptx/references/troubleshooting.md` when charts are blank, text is missing, content appears outside slides, or the source HTML is actually a long webpage embedded into a slide.
