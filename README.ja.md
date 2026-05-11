# html2pptx

ブラウザでレンダリングした HTML/WebDeck スライドを、編集可能な PowerPoint PPTX に変換します。

処理の流れは、Chromium で HTML をレンダリングし、実際の DOM/CSS/SVG/ECharts から編集可能な SVG プリミティブを抽出し、それを PowerPoint のネイティブ DrawingML 図形へ変換する、というものです。

GitHub: <https://github.com/GX-Alex/html2pptx>

## 主な機能

- 編集可能な PPTX を生成します。可能な限りテキストと図形を PowerPoint のネイティブオブジェクトとして保持します。
- ECharts を SVG renderer に切り替え、チャートをベクター要素として出力します。
- デフォルトではスライド全体のスクリーンショットにフォールバックしません。
- Codex skill、Claude Code / opencode のプロジェクト skill、通常の CLI として利用できます。
- 空白チャート、欠落テキスト、長い Web ページ型スライド、ブラウザ起動失敗のトラブルシューティングを含みます。

## 適したユースケース

入力 HTML がすでにスライドデッキとして設計されている場合に最も適しています。

- `.deck-slide`、`.deck-stage` を持つ WebDeck 形式の固定 16:9 スライド。
- 1280x720 のビューポートを前提に作られた HTML プレゼンテーション。
- DOM テキスト、CSS カードや罫線、SVG 図、ECharts チャートを編集可能な要素として残したい場合。
- ピクセル単位の完全再現より、PowerPoint 上での編集性を重視する場合。

長い Web ページ、ダッシュボード、記事ページを単に slide コンテナに入れた HTML では、この編集可能変換だけに依存しないでください。

## 必要環境

- Python 3.10+
- Node.js 18+
- Chrome または Chromium
- Python パッケージ: `python-pptx`

最小依存関係:

```bash
python -m pip install python-pptx
```

Playwright Chromium を使う場合:

```bash
python -m pip install playwright
python -m playwright install chromium
```

## クイックスタート

GitHub からクローンして依存関係をインストールします。

```bash
git clone https://github.com/GX-Alex/html2pptx.git
cd html2pptx
python -m pip install -r requirements.txt
```

HTML を変換します。

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx
```

Chrome が見つからない場合:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

中間 SVG を残してデバッグする場合:

```bash
python skills/html2pptx/scripts/html2pptx.py input.html -o output.pptx \
  --workdir /tmp/html2pptx-debug --keep-workdir
```

## AI エージェントツールでの使い方

### Codex

skill フォルダを Codex の skills ディレクトリへインストールします。

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/html2pptx "${CODEX_HOME:-$HOME/.codex}/skills/html2pptx"
```

呼び出し例:

```text
Use $html2pptx to convert this HTML deck into an editable PPTX.
```

Codex は `skills/html2pptx/SKILL.md` を読み、同梱スクリプトを実行します。

### Claude Code

Claude Code 用のプロジェクト skill 入口は次の場所にあります。

```text
.claude/skills/html2pptx/SKILL.md
```

使い方:

1. クローンした `html2pptx` リポジトリを Claude Code で開きます。
2. Claude Code に `html2pptx` skill を使うよう依頼します。

```text
Use the html2pptx skill in this repository to convert deck.html to deck.pptx.
```

3. Claude Code は `.claude/skills/html2pptx/SKILL.md` を読み、共有コンバーターを呼び出します。

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

skill を使わずに、この CLI を直接実行することもできます。

### opencode

opencode も、このリポジトリ内のプロジェクト skill を検出できます。

```text
.claude/skills/html2pptx/SKILL.md
```

使い方:

1. クローンした `html2pptx` リポジトリを opencode で開きます。
2. opencode に `html2pptx` skill を使うよう依頼します。

```text
Use the html2pptx skill to convert deck.html into an editable PowerPoint file.
```

3. opencode は `AGENTS.md` / `OPENCODE.md` のリポジトリ指示に従い、同じ CLI ラッパーを実行します。

```bash
python skills/html2pptx/scripts/html2pptx.py deck.html -o deck.pptx
```

つまり、Claude Code と opencode は `.claude/skills/html2pptx/SKILL.md` をプロジェクト skill の入口として使います。実際の変換処理は `skills/html2pptx` に集約されているため、実装は一箇所だけを保守すれば済みます。

## 編集可能性の確認

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

通常、`pictures=0` はスライド全体の画像フォールバックが使われていないことを示します。

## 既知の制限

- 長い Web ページ型のレイアウトは 1280x720 のスライド表示領域で切り取られます。
- スライド内に完全な `<!doctype html><html>...` 文書がネストされている場合は、前処理が必要になることがあります。
- CSS 疑似要素、外部 icon font、filter、shadow、複雑な mask は劣化する場合があります。
- サンドボックス環境では `--chrome` でブラウザ実行ファイルを明示する必要があります。

## 典型的な失敗例: スライド内の完全な HTML 文書

一部の生成ツールは、各スライド内に完全な Web ページを入れることがあります。

```html
<div class="deck-stage">
  <!doctype html>
  <html>
    <head>...</head>
    <body>...</body>
  </html>
</div>
```

これは通常のスライド断片ではありません。ブラウザはこの不正な DOM を自動修復するため、抽出器が意図した内容の一部しか見られない場合があります。さらに、そのページが `100vh` やスクロール型の長いレイアウトである場合、1280x720 の最初のビューポート外の内容は切り取られるか、PPT スライドの外に配置されます。前回の Hermes 例で問題が出たページは、この種類の「完全な Web ページ/長い Web ページ型レイアウト」であり、固定 16:9 の slide fragment ではありませんでした。変換前に HTML を通常のスライド断片へ前処理するか、長いページを分割・再レイアウトしてください。
