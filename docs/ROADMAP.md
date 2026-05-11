# Roadmap

This roadmap is intentionally practical. The goal is to improve editable PowerPoint output for real HTML/WebDeck decks without turning the project into a browser screenshot exporter.

## Near Term

- Add more example HTML decks, including ECharts-heavy slides.
- Add visual regression fixtures for DOM-to-SVG extraction.
- Improve table extraction for dense report slides.
- Improve text style preservation for bold, underline, color, and mixed inline runs.
- Document known behavior for long-page or nested full-document slides.

## Medium Term

- Add optional preprocessing for malformed slides that embed full HTML documents.
- Improve support for CSS shadows and common gradients.
- Add better icon font detection and fallback guidance.
- Add comparison scripts that count editable shapes, pictures, and text runs in generated PPTX files.
- Package a small test gallery for contributors.

## Good First Issues

- Add an ECharts example deck under `examples/`.
- Add a README demo screenshot showing selected editable text in PowerPoint.
- Improve `docs/PROMOTION.md` with one more launch channel.
- Add troubleshooting notes for a real failed deck and its root cause.
- Add a small script that prints PPTX shape counts for validation.

## Non-Goals

- Pixel-perfect conversion of arbitrary webpages.
- Replacing PowerPoint's design and layout engine.
- Treating every slide as a full-page screenshot by default.
