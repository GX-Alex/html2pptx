# Changelog

## Unreleased

- Added automatic single-slide wrapping for plain HTML files that do not contain `.deck-slide`.
- Improved ECharts extraction by rebuilding already-initialized chart instances with the SVG renderer when possible.
- Preserved uniform rounded CSS borders as editable stroked rounded rectangles instead of four straight border lines.
- Preserved inline SVG children inside text-bearing nodes and resolved `currentColor` to concrete SVG colors.
- Inlined a small offline Font Awesome Free solid icon subset before extraction so common `<i class="fa-...">` icons become editable SVG paths.
- Added cross-platform Chrome discovery, Windows-friendly documentation, and `--chrome-path` as an alias for `--chrome`.

## v0.1.0 - Initial Open Source Release

- Added HTML/WebDeck to editable PPTX conversion pipeline.
- Added Chromium DOM/CSS/SVG/ECharts extraction into editable SVG primitives.
- Added SVG-to-PowerPoint DrawingML conversion.
- Added Codex skill support through `skills/html2pptx`.
- Added Claude Code and opencode project-skill entry point through `.claude/skills/html2pptx`.
- Added multilingual documentation in English, Simplified Chinese, and Japanese.
- Added troubleshooting notes for blank charts, missing text, long webpages, and browser launch issues.
