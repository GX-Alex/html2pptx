# Promotion Kit

Use this file when announcing `html2pptx` in communities, social posts, newsletters, or adjacent projects.

## One-Liner

`html2pptx` converts browser-rendered HTML/WebDeck slide decks into editable PowerPoint PPTX files instead of screenshot-only exports.

## Short Description

Most HTML-to-PPTX workflows flatten each slide into an image. `html2pptx` renders the deck in Chromium, extracts visible DOM/CSS/SVG/ECharts content into editable SVG primitives, then converts those primitives to native PowerPoint DrawingML shapes.

It is best for AI-generated HTML decks, WebDeck-style presentations, ECharts-heavy slides, and workflows where users need to keep editing the PPTX after export.

## Suggested GitHub Topics

Add these topics in the GitHub repository settings:

```text
html-to-pptx
pptx
powerpoint
presentation
slides
webdeck
svg-to-pptx
echarts
editable-pptx
ai-presentation
codex-skill
claude-code
opencode
```

## Social Preview

Use `assets/social-preview.svg` as the source artwork for the repository social preview.

GitHub's social preview upload UI expects an image file. If SVG upload is not accepted in the UI, export it to PNG first:

```bash
inkscape assets/social-preview.svg --export-type=png --export-filename=assets/social-preview.png
```

or use any browser/design tool to export the SVG at 1280x640.

## Launch Post

Title:

```text
html2pptx: convert HTML/WebDeck slides to editable PowerPoint, not screenshots
```

Body:

```text
I open-sourced html2pptx, a small pipeline for converting browser-rendered HTML/WebDeck slide decks into editable PowerPoint PPTX files.

Most HTML-to-PPTX exporters produce screenshot-only slides. This project tries to preserve DOM text, CSS boxes, SVG primitives, and ECharts charts as native PowerPoint objects.

It works best for fixed 16:9 HTML decks, AI-generated presentation pages, WebDeck-style documents, and ECharts-heavy slides.

Repo: https://github.com/GX-Alex/html2pptx
```

## Show HN Draft

```text
Show HN: html2pptx - Editable PowerPoint export from HTML/WebDeck

I built html2pptx because screenshot-based HTML-to-PPTX export is painful when the generated PowerPoint still needs editing.

The pipeline renders the deck in Chromium, extracts visible DOM/CSS/SVG/ECharts content into editable SVG primitives, and converts those primitives to native PowerPoint DrawingML shapes.

It is not meant to be pixel-perfect for arbitrary long webpages. It works best for fixed 16:9 HTML slide decks, WebDeck documents, and ECharts-heavy presentation pages.

GitHub: https://github.com/GX-Alex/html2pptx
```

## Chinese Launch Draft

```text
我开源了 html2pptx：把 HTML/WebDeck 演示文稿转换成可编辑的 PowerPoint，而不是整页截图。

它会用 Chromium 渲染 HTML，从真实 DOM/CSS/SVG/ECharts 中抽取可编辑 SVG 原语，再转换成 PowerPoint 原生 DrawingML 形状。

适合 AI 生成 PPT、WebDeck、ECharts 图表比较多的 HTML 演示文稿，以及后续还需要在 PowerPoint 里编辑的场景。

GitHub: https://github.com/GX-Alex/html2pptx
```

## Communities To Try

- Hacker News: use the Show HN draft after adding demo screenshots.
- V2EX: post under programming or share.
- Reddit: `r/opensource`, `r/webdev`, `r/PowerPoint`, `r/ClaudeAI`.
- X / LinkedIn / 即刻: use the social preview plus a before/after image.
- Adjacent projects: WebDeck, ECharts slide generators, AI presentation tools, and HTML-to-PPTX exporters.

## Outreach Angle

Avoid generic self-promotion. Lead with a specific user pain:

- "I need editable PowerPoint output from AI-generated HTML decks."
- "ECharts disappears or becomes a flat image in PPTX exports."
- "HTML-to-PPTX screenshot export looks fine but cannot be edited."

Then show the repo only after describing the solved problem.
