# html2pptx

Convert browser-rendered HTML/WebDeck slide decks to editable PowerPoint PPTX files, not screenshot-only exports.

GitHub: <https://github.com/GX-Alex/html2pptx>

![html2pptx demo overview](assets/demo-overview.svg)

Choose a language:

- [English](README.en.md)
- [简体中文](README.zh-CN.md)
- [日本語](README.ja.md)

## What This Repository Contains

- `skills/html2pptx`: the shared implementation skill folder and scripts.
- `.claude/skills/html2pptx/SKILL.md`: project-skill entry point for Claude Code and opencode.
- `skills/html2pptx/scripts/html2pptx.py`: command-line wrapper.
- `skills/html2pptx/scripts/html_dom_to_editable_svg.js`: Chromium DOM/CSS/SVG extractor.
- `skills/html2pptx/scripts/svg_to_pptx`: native DrawingML PPTX converter.
- `AGENTS.md`, `CLAUDE.md`, `OPENCODE.md`: agent-specific usage notes.
- `examples/basic-deck.html`: minimal deck for a first conversion test.
- `docs/PROMOTION.md`: launch copy, GitHub topics, and outreach notes.

## Quick Start After Clone

```bash
git clone https://github.com/GX-Alex/html2pptx.git
cd html2pptx
python -m pip install -r requirements.txt
python skills/html2pptx/scripts/html2pptx.py examples/basic-deck.html -o basic-deck.pptx
```

## Agent Usage

- **Codex**: install `skills/html2pptx` into `${CODEX_HOME:-$HOME/.codex}/skills`, then invoke `$html2pptx`.
- **Claude Code**: open the cloned repository. Claude Code can discover the project skill at `.claude/skills/html2pptx/SKILL.md`; you can ask it to use the `html2pptx` skill.
- **opencode**: open the cloned repository. opencode can also discover `.claude/skills/html2pptx/SKILL.md`; `AGENTS.md` and `OPENCODE.md` provide the repo-level instructions.

All agents ultimately call the same command:

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

## Project Visibility Checklist

- Add GitHub topics listed in `docs/PROMOTION.md`.
- Use `assets/social-preview.svg` as the source artwork for the repository social preview.
- Publish `v0.1.0` with the notes in `CHANGELOG.md`.
- Share the launch drafts in `docs/PROMOTION.md`.
- Label beginner-friendly tasks using the templates in `.github/ISSUE_TEMPLATE/`.
