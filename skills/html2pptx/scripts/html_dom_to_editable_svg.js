#!/usr/bin/env node
/**
 * Convert a fixed-size HTML slide deck into PPT Master editable SVG pages.
 *
 * It uses Chrome only as a layout engine. The output SVG contains native
 * rect/text/path primitives so ppt-master's svg_to_pptx native mode can turn
 * them into editable PowerPoint shapes.
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const CANVAS_W = 1280;
const CANVAS_H = 720;
const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return await res.json();
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function launchChrome(profileDir) {
  const port = 9339 + Math.floor(Math.random() * 1000);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--metrics-recording-only",
    "--use-mock-keychain",
    "--password-store=basic",
    `--window-size=${CANVAS_W},${CANVAS_H}`,
    "about:blank",
  ];
  const proc = spawn(CHROME, args, { stdio: "ignore" });
  for (let i = 0; i < 80; i += 1) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return { proc, port, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      await wait(250);
    }
    await wait(250);
  }
  proc.kill("SIGTERM");
  throw new Error("Timed out waiting for Chrome remote debugging");
}

const extractorSource = String.raw`
(async () => {
  const W = 1280, H = 720;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const override = document.createElement("style");
  override.textContent = [
    "html,body{width:1280px!important;height:720px!important;overflow:hidden!important;margin:0!important}",
    "#deck-progress,#deck-nav-overlay{display:none!important}",
    "#slides-container{position:fixed!important;inset:0!important;width:1280px!important;height:720px!important}",
    ".deck-slide{position:fixed!important;inset:0!important;width:1280px!important;height:720px!important;overflow:hidden!important}",
    ".deck-stage{transform:none!important;position:absolute!important;top:0!important;left:0!important;width:1280px!important;height:720px!important;overflow:hidden!important}",
    "iconify-icon{display:none!important}"
  ].join("\n");
  document.head.appendChild(override);

  function num(v, fallback = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function rgba(c) {
    if (!c || c === "transparent") return null;
    if (c[0] === "#") {
      const hex = c.length === 4
        ? "#" + c.slice(1).split("").map((ch) => ch + ch).join("").toUpperCase()
        : c.slice(0, 7).toUpperCase();
      return { hex, opacity: 1 };
    }
    const m = c.match(/rgba?\(([^)]+)\)/i);
    if (!m) return null;
    const parts = m[1].split(",").map((p) => p.trim());
    const r = Math.round(num(parts[0]));
    const g = Math.round(num(parts[1]));
    const b = Math.round(num(parts[2]));
    const a = parts.length > 3 ? num(parts[3], 1) : 1;
    if (a <= 0) return null;
    const hex = "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("").toUpperCase();
    return { hex, opacity: Math.max(0, Math.min(1, a)) };
  }

  function inlineColor(el, prop) {
    const style = el.getAttribute("style") || "";
    const re = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)", "i");
    const m = style.match(re);
    if (!m) return null;
    const value = m[1].trim();
    const hex = value.match(/#[0-9a-f]{3,8}/i);
    if (hex) return rgba(hex[0]);
    const rgb = value.match(/rgba?\([^)]+\)/i);
    return rgb ? rgba(rgb[0]) : null;
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(W, r.left)),
      y: Math.max(0, Math.min(H, r.top)),
      w: Math.max(0, Math.min(W, r.right) - Math.max(0, r.left)),
      h: Math.max(0, Math.min(H, r.bottom) - Math.max(0, r.top)),
      rawW: r.width,
      rawH: r.height,
    };
  }

  function visible(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && num(cs.opacity, 1) > 0 && r.width > 0.5 && r.height > 0.5;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForEchartsIfNeeded() {
    if (!document.querySelector('script[type="application/webdeck-chart-init"]')) return;
    for (let i = 0; i < 60; i += 1) {
      if (window.echarts && typeof window.echarts.init === "function") return;
      await sleep(250);
    }
  }

  function forceEchartsSvgRenderer() {
    if (!window.echarts || window.echarts.__webdeckSvgPatched) return;
    const originalInit = window.echarts.init.bind(window.echarts);
    window.echarts.init = function(dom, theme, opts) {
      const nextOpts = Object.assign({}, opts || {}, { renderer: "svg" });
      return originalInit(dom, theme, nextOpts);
    };
    window.echarts.__webdeckSvgPatched = true;
  }

  function runChartScripts(slide) {
    if (!slide || !window.echarts) return;
    forceEchartsSvgRenderer();
    slide.querySelectorAll('script[type="application/webdeck-chart-init"]').forEach((script) => {
      try {
        script.removeAttribute("data-webdeck-executed");
        new Function(script.textContent || "")();
        script.setAttribute("data-webdeck-executed", "true");
      } catch (error) {
        console.warn("[html_dom_to_editable_svg] chart init failed", error);
      }
    });
    slide.querySelectorAll("[_echarts_instance_]").forEach((node) => {
      try {
        const instance = window.echarts.getInstanceByDom(node);
        if (instance) instance.resize({ animation: false });
      } catch {}
    });
  }

  function hasVisibleBackground(el, cs) {
    const bg = rgba(cs.backgroundColor) || inlineColor(el, "background-color") || inlineColor(el, "background");
    return bg && bg.opacity > 0.01;
  }

  function hasBorder(cs) {
    return borderSides(cs).length > 0;
  }

  function borderSides(cs) {
    return ["Top", "Right", "Bottom", "Left"].map((side) => {
      const width = num(cs["border" + side + "Width"]);
      const style = cs["border" + side + "Style"];
      const color = rgba(cs["border" + side + "Color"]);
      return width > 0 && style !== "none" && style !== "hidden" && color
        ? { side, width, color }
        : null;
    }).filter(Boolean);
  }

  function fontFamily(cs) {
    const f = cs.fontFamily || "Arial, Microsoft YaHei, sans-serif";
    return f.includes("Microsoft YaHei") || f.includes("PingFang")
      ? "Microsoft YaHei, Arial, sans-serif"
      : f;
  }

  const blockTags = new Set(["DIV","SECTION","ARTICLE","UL","OL","TABLE","TBODY","THEAD","TR","SVG"]);
  const textTags = new Set(["H1","H2","H3","H4","H5","H6","P","SPAN","LI","TD","TH","CODE","PRE","STRONG","EM","B","I","SMALL","DIV"]);

  function directText(el) {
    let out = "";
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) out += n.nodeValue;
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\[\s*Data\s*:\s*/g, "[Data: ")
      .replace(/\s+\]/g, "]")
      .trim();
  }

  function shouldEmitText(el) {
    if (!textTags.has(el.tagName)) return false;
    const isDiv = el.tagName === "DIV";
    const txt = cleanText(isDiv ? directText(el) : (el.innerText || directText(el) || ""));
    if (!txt) return false;
    if (isDiv && el.children.length > 0 && !directText(el)) return false;
    return true;
  }

  function wrapText(ctx, text, maxWidth) {
    const hard = String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const lines = [];
    for (const part of hard) {
      const tokens = part.match(/[A-Za-z0-9_./:+#-]+|[\u4e00-\u9fff]|\S/g) || [];
      let line = "";
      for (const tok of tokens) {
        const needsSpace = line
          && /^[A-Za-z0-9_./:+#-]+$/.test(tok)
          && !/[\[(（]$/.test(line);
        const trial = needsSpace ? line + " " + tok : line + tok;
        if (line && ctx.measureText(trial).width > maxWidth) {
          lines.push(line);
          line = tok;
        } else {
          line = trial;
        }
      }
      if (line) lines.push(line);
    }
    return lines.length ? lines : [text];
  }

  function collectSvg(el, slideRect) {
    const box = rectOf(el);
    const vb = el.getAttribute("viewBox");
    const parts = vb ? vb.split(/[\s,]+/).map(Number) : [0, 0, num(el.getAttribute("width"), box.rawW || box.w), num(el.getAttribute("height"), box.rawH || box.h)];
    const vbW = parts[2] || box.rawW || box.w || 1;
    const vbH = parts[3] || box.rawH || box.h || 1;
    const clone = el.cloneNode(true);
    clone.querySelectorAll("style, script, foreignObject").forEach((n) => n.remove());
    clone.querySelectorAll("*").forEach((n) => {
      const style = n.getAttribute("style");
      if (style) {
        style.split(";").forEach((decl) => {
          const idx = decl.indexOf(":");
          if (idx <= 0) return;
          const key = decl.slice(0, idx).trim();
          const value = decl.slice(idx + 1).trim();
          if (["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-family", "font-weight", "text-anchor"].includes(key)) {
            n.setAttribute(key, value);
          }
        });
      }
      n.removeAttribute("style");
      n.removeAttribute("class");
      n.removeAttribute("clip-path");
      ["fill", "stroke"].forEach((attr) => {
        const value = n.getAttribute(attr);
        const parsed = rgba(value);
        if (parsed) {
          n.setAttribute(attr, parsed.hex);
          if (parsed.opacity < 1 && !n.getAttribute(attr + "-opacity")) {
            n.setAttribute(attr + "-opacity", String(parsed.opacity));
          }
        }
      });
      ["font-size", "stroke-width", "x", "y", "width", "height", "rx", "ry"].forEach((attr) => {
        const value = n.getAttribute(attr);
        if (value && /^-?\d+(\.\d+)?px$/.test(value.trim())) {
          n.setAttribute(attr, value.trim().replace(/px$/, ""));
        }
      });
      if (n.tagName && n.tagName.toLowerCase() === "text") {
        const t = n.getAttribute("transform") || "";
        const x0 = num(n.getAttribute("x"));
        const y0 = num(n.getAttribute("y"));
        let m = t.match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/);
        if (m) {
          n.setAttribute("x", String(x0 + num(m[1])));
          n.setAttribute("y", String(y0 + num(m[2])));
          n.removeAttribute("transform");
        }
        m = t.match(/matrix\(\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*\)/);
        if (m) {
          const a = num(m[1], 1), b = num(m[2]), e = num(m[5]), f = num(m[6]);
          const x = x0 + e;
          const y = y0 + f;
          const angle = Math.atan2(b, a) * 180 / Math.PI;
          n.setAttribute("x", String(x));
          n.setAttribute("y", String(y));
          if (Math.abs(angle) > 0.1) n.setAttribute("transform", "rotate(" + angle + " " + x + " " + y + ")");
          else n.removeAttribute("transform");
        }
      }
      if (n.tagName && n.tagName.toLowerCase() === "path") {
        const t = n.getAttribute("transform") || "";
        const d = n.getAttribute("d") || "";
        const m = t.match(/matrix\(\s*([-\d.]+)[\s,]+0[\s,]+0[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*\)/);
        if (m && /^M\s*1\s+0\s*A\s*1\s+1/i.test(d)) {
          const r = Math.max(Math.abs(num(m[1])), Math.abs(num(m[2])));
          const cx = num(m[3]);
          const cy = num(m[4]);
          const circle = document.createElementNS(SVG_NS, "circle");
          circle.setAttribute("cx", String(cx));
          circle.setAttribute("cy", String(cy));
          circle.setAttribute("r", String(r));
          ["fill", "stroke", "stroke-width", "fill-opacity", "stroke-opacity"].forEach((attr) => {
            const value = n.getAttribute(attr);
            if (value != null) circle.setAttribute(attr, value);
          });
          n.replaceWith(circle);
        }
      }
    });
    clone.querySelectorAll("[marker-start],[marker-end]").forEach((n) => {
      n.removeAttribute("marker-start");
      n.removeAttribute("marker-end");
    });
    clone.removeAttribute("class");
    clone.removeAttribute("style");
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.removeAttribute("viewBox");
    const inner = clone.innerHTML;
    return {
      type: "raw",
      x: box.x - slideRect.x,
      y: box.y - slideRect.y,
      sx: box.w / vbW,
      sy: box.h / vbH,
      content: inner,
    };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function walk(el, slideRect, items, seenText) {
    if (!visible(el)) return;
    if (el.tagName === "STYLE" || el.tagName === "SCRIPT") return;
    if (el instanceof SVGSVGElement) {
      items.push(collectSvg(el, slideRect));
      return;
    }

    const cs = getComputedStyle(el);
    const box = rectOf(el);
    const x = box.x - slideRect.x;
    const y = box.y - slideRect.y;

    const sides = borderSides(cs);
    if (hasVisibleBackground(el, cs) || sides.length > 0) {
      const bg = rgba(cs.backgroundColor) || inlineColor(el, "background-color") || inlineColor(el, "background");
      items.push({
        type: "rect",
        x, y,
        w: box.w,
        h: box.h,
        rx: Math.min(num(cs.borderTopLeftRadius), box.w / 2, box.h / 2),
        fill: bg ? bg.hex : "none",
        fillOpacity: bg ? bg.opacity : 0,
        stroke: "none",
        strokeOpacity: 0,
        strokeWidth: 0,
      });
      for (const border of sides) {
        const side = border.side;
        const x1 = side === "Right" ? x + box.w : x;
        const x2 = side === "Left" ? x : x + box.w;
        const y1 = side === "Bottom" ? y + box.h : y;
        const y2 = side === "Top" ? y : y + box.h;
        items.push({
          type: "line",
          x1: side === "Right" || side === "Left" ? x1 : x,
          y1: side === "Top" || side === "Bottom" ? y1 : y,
          x2: side === "Right" || side === "Left" ? x1 : x + box.w,
          y2: side === "Top" || side === "Bottom" ? y1 : y + box.h,
          stroke: border.color.hex,
          strokeOpacity: border.color.opacity,
          strokeWidth: border.width,
        });
      }
    }

    if (shouldEmitText(el) && !seenText.has(el)) {
      seenText.add(el);
      const text = cleanText(el.tagName === "DIV" ? directText(el) : (el.innerText || ""));
      const color = rgba(cs.color) || inlineColor(el, "color") || { hex: "#000000", opacity: 1 };
      const fontSize = num(cs.fontSize, 16);
      const fontWeight = cs.fontWeight || "400";
      const lineHeight = cs.lineHeight === "normal" ? fontSize * 1.25 : num(cs.lineHeight, fontSize * 1.25);
      const paddingLeft = num(cs.paddingLeft);
      const paddingRight = num(cs.paddingRight);
      const paddingTop = num(cs.paddingTop);
      const align = cs.textAlign === "center" ? "middle" : (cs.textAlign === "right" || cs.textAlign === "end" ? "end" : "start");
      const usableW = Math.max(10, box.w - paddingLeft - paddingRight);
      ctx.font = fontWeight + " " + fontSize + "px " + fontFamily(cs);
      const lines = wrapText(ctx, text, usableW);
      const baseX = align === "middle" ? x + box.w / 2 : (align === "end" ? x + box.w - paddingRight : x + paddingLeft);
      let baseY = y + paddingTop + fontSize;
      for (const line of lines) {
        if (baseY > H + 20) break;
        items.push({
          type: "text",
          x: baseX,
          y: baseY,
          text: line,
          fill: color.hex,
          fillOpacity: color.opacity,
          fontSize,
          fontWeight,
          fontFamily: fontFamily(cs),
          textAnchor: align,
          fontStyle: cs.fontStyle,
        });
        baseY += lineHeight;
      }
      return;
    }

    for (const child of el.children) {
      walk(child, slideRect, items, seenText);
    }
  }

  await waitForEchartsIfNeeded();
  forceEchartsSvgRenderer();

  const slides = [...document.querySelectorAll(".deck-slide")];
  const result = [];
  for (const [idx, slide] of slides.entries()) {
    slides.forEach((s) => { s.style.display = "none"; s.classList.remove("active"); });
    slide.style.display = "block";
    slide.classList.add("active");
    const stage = slide.querySelector(".deck-stage");
    if (stage) stage.style.transform = "none";
    runChartScripts(slide);
    await sleep(100);
    const slideRect = slide.getBoundingClientRect();
    const items = [{ type: "rect", x: 0, y: 0, w: W, h: H, rx: 0, fill: "#FFFFFF", fillOpacity: 1, stroke: "none", strokeOpacity: 0, strokeWidth: 0 }];
    walk(slide, slideRect, items, new Set());
    result.push({ index: idx + 1, text: cleanText(slide.innerText || ""), items });
  }
  return result;
})()
`;

function svgForSlide(slide) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">`,
    `  <g id="background">`,
  ];
  let groupOpen = true;
  for (const item of slide.items) {
    if (item.type !== "rect" && groupOpen) {
      parts.push(`  </g>`);
      parts.push(`  <g id="content">`);
      groupOpen = false;
    }
    if (item.type === "rect") {
      const attrs = [
        `x="${item.x.toFixed(2)}"`,
        `y="${item.y.toFixed(2)}"`,
        `width="${item.w.toFixed(2)}"`,
        `height="${item.h.toFixed(2)}"`,
        item.rx ? `rx="${item.rx.toFixed(2)}"` : "",
        `fill="${item.fill}"`,
        item.fillOpacity < 1 ? `fill-opacity="${item.fillOpacity.toFixed(3)}"` : "",
        `stroke="${item.stroke}"`,
        item.stroke !== "none" && item.strokeWidth ? `stroke-width="${item.strokeWidth.toFixed(2)}"` : "",
        item.strokeOpacity > 0 && item.strokeOpacity < 1 ? `stroke-opacity="${item.strokeOpacity.toFixed(3)}"` : "",
      ].filter(Boolean);
      parts.push(`    <rect ${attrs.join(" ")}/>`);
    } else if (item.type === "text") {
      const attrs = [
        `x="${item.x.toFixed(2)}"`,
        `y="${item.y.toFixed(2)}"`,
        `font-family="${esc(item.fontFamily)}"`,
        `font-size="${item.fontSize.toFixed(2)}"`,
        `font-weight="${esc(item.fontWeight)}"`,
        item.fontStyle && item.fontStyle !== "normal" ? `font-style="${esc(item.fontStyle)}"` : "",
        `fill="${item.fill}"`,
        item.fillOpacity < 1 ? `fill-opacity="${item.fillOpacity.toFixed(3)}"` : "",
        item.textAnchor !== "start" ? `text-anchor="${item.textAnchor}"` : "",
      ].filter(Boolean);
      parts.push(`    <text ${attrs.join(" ")}>${esc(item.text)}</text>`);
    } else if (item.type === "line") {
      const attrs = [
        `x1="${item.x1.toFixed(2)}"`,
        `y1="${item.y1.toFixed(2)}"`,
        `x2="${item.x2.toFixed(2)}"`,
        `y2="${item.y2.toFixed(2)}"`,
        `stroke="${item.stroke}"`,
        `stroke-width="${item.strokeWidth.toFixed(2)}"`,
        item.strokeOpacity < 1 ? `stroke-opacity="${item.strokeOpacity.toFixed(3)}"` : "",
      ].filter(Boolean);
      parts.push(`    <line ${attrs.join(" ")}/>`);
    } else if (item.type === "raw") {
      parts.push(`    <g transform="translate(${item.x.toFixed(2)} ${item.y.toFixed(2)}) scale(${item.sx.toFixed(6)} ${item.sy.toFixed(6)})">`);
      parts.push(item.content);
      parts.push(`    </g>`);
    }
  }
  parts.push(groupOpen ? `  </g>` : `  </g>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

async function main() {
  const [htmlFileArg, projectDirArg] = process.argv.slice(2);
  if (!htmlFileArg || !projectDirArg) {
    console.error("Usage: node tools/html_dom_to_editable_svg.js <deck.html> <project_dir>");
    process.exit(2);
  }
  const htmlFile = path.resolve(htmlFileArg);
  const projectDir = path.resolve(projectDirArg);
  const profile = path.join(projectDir, "chrome-profile");
  rmrf(projectDir);
  ["sources", "images", "svg_output", "svg_final", "notes", "exports"].forEach((d) => mkdirp(path.join(projectDir, d)));
  fs.copyFileSync(htmlFile, path.join(projectDir, "sources", path.basename(htmlFile)));

  const chrome = await launchChrome(profile);
  let cdp;
  try {
    cdp = new Cdp(chrome.wsUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: CANVAS_W,
      height: CANVAS_H,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: pathToFileURL(htmlFile).href });
    for (let i = 0; i < 80; i += 1) {
      const ready = await cdp.send("Runtime.evaluate", {
        expression: "({href: location.href, ready: document.readyState, slides: document.querySelectorAll('.deck-slide').length})",
        returnByValue: true,
      });
      const value = ready.result.value || {};
      if (value.href && value.href !== "about:blank" && value.ready !== "loading" && value.slides > 0) {
        break;
      }
      await wait(250);
    }
    await wait(500);
    const evalResult = await cdp.send("Runtime.evaluate", {
      expression: extractorSource,
      returnByValue: true,
      awaitPromise: true,
    });
    if (evalResult.exceptionDetails) {
      throw new Error(JSON.stringify(evalResult.exceptionDetails));
    }
    const slides = evalResult.result.value;
    slides.forEach((slide) => {
      const stem = `${String(slide.index).padStart(2, "0")}_slide`;
      const svg = svgForSlide(slide);
      fs.writeFileSync(path.join(projectDir, "svg_output", `${stem}.svg`), svg, "utf8");
      fs.writeFileSync(path.join(projectDir, "svg_final", `${stem}.svg`), svg, "utf8");
      fs.writeFileSync(path.join(projectDir, "notes", `${stem}.md`), `# Slide ${slide.index}\n\n${slide.text}\n`, "utf8");
    });
    const total = slides.map((s) => `# Slide ${s.index}\n\n${s.text}`).join("\n\n");
    fs.writeFileSync(path.join(projectDir, "notes", "total.md"), total, "utf8");
    fs.writeFileSync(path.join(projectDir, "README.md"), [
      "# PresentationAgent editable HTML conversion",
      "",
      "- Canvas format: ppt169",
      `- Source: \`${htmlFile}\``,
      "- Pipeline: HTML DOM/CSS layout -> editable SVG primitives -> PPT Master native PPTX",
      "",
    ].join("\n"), "utf8");
    console.log(`Created editable SVG project with ${slides.length} slides: ${projectDir}`);
  } finally {
    if (cdp) cdp.close();
    chrome.proc.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
