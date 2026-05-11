# Integration Notes

## Repository Layout

Recommended GitHub repository layout:

```text
html2pptx/
├── README.md
├── README.en.md
├── README.zh-CN.md
├── README.ja.md
├── AGENTS.md
├── CLAUDE.md
├── OPENCODE.md
└── skills/
    └── html2pptx/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── references/
        └── scripts/
```

## Codex

Install by copying `skills/html2pptx` into a discoverable skills directory:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/html2pptx "${CODEX_HOME:-$HOME/.codex}/skills/html2pptx"
```

Invoke with:

```text
Use $html2pptx to convert deck.html to editable PPTX.
```

## Claude Code

Claude Code does not require Codex skill discovery. Use `CLAUDE.md` and call:

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

## opencode

Use `AGENTS.md` or `OPENCODE.md` as project instructions and call the same wrapper script.

## Backend Integration

To embed in a web service:

1. Persist published deck HTML to a temp file.
2. Call `scripts/html2pptx.py`.
3. Serve the resulting PPTX from an export directory.
4. Use a per-request temp directory and remove it after success/failure.

Set `CHROME=/path/to/chrome` in the service environment when the default Chrome path is not valid.
