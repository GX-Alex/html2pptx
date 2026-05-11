# html2pptx

将浏览器渲染后的 HTML/WebDeck 演示文稿转换为可编辑 PowerPoint PPTX。

流程是：用 Chromium 渲染 HTML，从真实 DOM/CSS/SVG/ECharts 中抽取可编辑 SVG 原语，再把 SVG 原语转换为 PowerPoint 原生 DrawingML 形状。

GitHub：<https://github.com/GX-Alex/html2pptx>

## 功能特性

- 输出可编辑 PPTX：文本、形状尽量保留为 PowerPoint 原生对象。
- 更好的图表支持：将 ECharts 强制为 SVG renderer，尽量导出为矢量原语。
- 默认不使用整页截图兜底。
- 既可以作为 Codex skill 使用，也可以作为 Claude Code / opencode 的普通 CLI 使用。
- 附带空白图表、文本缺失、长网页页面、浏览器启动失败等排障说明。

## 适合使用场景

当源 HTML 本身就是“幻灯片形态”时，最适合使用本工具：

- WebDeck 风格文档，包含 `.deck-slide`、`.deck-stage`，并且每页是固定 16:9 画布。
- 每页按 1280x720 视口设计的 HTML 演示文稿。
- 需要保留 DOM 文本、CSS 卡片/线条、SVG 图示、ECharts 图表为可编辑对象的场景。
- 更重视 PPT 后续可编辑性，而不是截图级像素完全一致的场景。

如果源 HTML 本质是长网页、仪表盘、文章页，只是被塞进 slide 容器里，不建议只依赖这个可编辑导出流程。

## 环境要求

- Python 3.10+
- Node.js 18+
- Chrome 或 Chromium
- Python 依赖：`python-pptx`

安装最小依赖：

```bash
python -m pip install python-pptx
```

如果使用 Playwright Chromium：

```bash
python -m pip install playwright
python -m playwright install chromium
```

## 快速使用

从 GitHub 克隆并安装依赖：

```bash
git clone https://github.com/GX-Alex/html2pptx.git
cd html2pptx
python -m pip install -r requirements.txt
```

转换 HTML：

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

如果找不到 Chrome：

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

保留中间 SVG 方便调试：

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --workdir /tmp/html2pptx-debug --keep-workdir
```

## 在智能体工具中使用

### Codex

将 skill 目录安装到 Codex 的 skills 目录：

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/html2pptx "${CODEX_HOME:-$HOME/.codex}/skills/html2pptx"
```

然后这样调用：

```text
Use $html2pptx to convert this HTML deck into an editable PPTX.
```

Codex 会读取 `skills/html2pptx/SKILL.md`，然后调用内置脚本完成转换。

### Claude Code

在 Claude Code 中打开本仓库，让 Claude 读取 `CLAUDE.md`，或者直接运行：

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

### opencode

在 opencode 中打开本仓库，让它读取 `OPENCODE.md` 或 `AGENTS.md`，然后运行同一个 CLI 包装脚本。

## 验证是否可编辑

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

通常 `pictures=0` 表示没有使用整页图片兜底。

## 已知限制

- 长网页式页面会被裁剪到 1280x720 视口。
- slide 内嵌完整 `<!doctype html><html>...` 文档时，可能需要预处理。
- CSS 伪元素、外部 icon font、filter、shadow、复杂 mask 等可能退化。
- 沙箱环境中浏览器启动可能需要显式传入 `--chrome`。

## 典型失败场景：slide 内嵌完整网页

有些生成器会把完整网页塞进每一页 slide，例如：

```html
<div class="deck-stage">
  <!doctype html>
  <html>
    <head>...</head>
    <body>...</body>
  </html>
</div>
```

这不是正常的幻灯片片段。浏览器会自动修正这种非法 DOM，抽取器可能只能看到部分内容。如果这个内嵌页面还是 `100vh` 或可滚动长网页布局，超出 1280x720 首屏的内容会被裁剪，或者落到 PPT 页面外。上一个 Hermes 案例中转换效果不好的页面就属于这一类：页面内容是完整网页/长网页式复杂布局，而不是固定 16:9 slide fragment。解决方式是先把 HTML 预处理成真正的单页幻灯片片段，或把长页面拆分/重排后再转换。
