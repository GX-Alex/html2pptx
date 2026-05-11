# Claude Code Instructions

This repository packages an HTML/WebDeck to editable PPTX workflow.

Use this repository when the user wants a local HTML/WebDeck presentation converted into an editable PowerPoint file. Prefer it for fixed-size slide decks, especially those with DOM text, CSS boxes, SVG diagrams, or ECharts charts.

Claude Code project skill:

```text
.claude/skills/html2pptx/SKILL.md
```

Ask Claude Code to use the `html2pptx` skill when converting a deck. The project skill delegates to the shared implementation under `skills/html2pptx`.

Run:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

If Chromium is blocked or not found, pass:

```bash
--chrome "/path/to/Chrome or Chromium"
```

For debugging, keep the intermediate project with `--keep-workdir` and inspect the generated SVG slides.

Do not describe the result as pixel-perfect. The intended output is an editable PPTX with native PowerPoint text and vector shapes where possible. If a page is a long webpage or a nested full HTML document inside a slide, explain that preprocessing may be needed.

Shared implementation:

- `.claude/skills/html2pptx/SKILL.md`: Claude Code project-skill entry point.
- `skills/html2pptx/SKILL.md`: full procedural guide.
- `skills/html2pptx/scripts/html2pptx.py`: CLI wrapper used by all agents.
