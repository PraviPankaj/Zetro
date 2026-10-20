/**
 * Barcode label sheets — renders product name + price (small) + barcode.
 * Prints via a hidden iframe so no pop-up is needed, same as bill receipts.
 */

import JsBarcode from "jsbarcode";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Layout presets. Roll = one label per page; sheet = grid on A4. */
export const LABEL_LAYOUTS = {
  roll_50x25: { label: "Roll · 50 × 25 mm", kind: "roll", w: 50, h: 25 },
  roll_38x25: { label: "Roll · 38 × 25 mm", kind: "roll", w: 38, h: 25 },
  roll_50x30: { label: "Roll · 50 × 30 mm", kind: "roll", w: 50, h: 30 },
  a4_3x8: { label: "A4 sheet · 3 × 8 (24 / page)", kind: "sheet", cols: 3, rows: 8, w: 63.5, h: 33.9 },
  a4_4x10: { label: "A4 sheet · 4 × 10 (40 / page)", kind: "sheet", cols: 4, rows: 10, w: 48, h: 25.4 },
};

export const DEFAULT_LAYOUT = "roll_50x25";

function isEan13(code) {
  return /^\d{13}$/.test(code);
}

/** Render a barcode to an SVG string. Falls back to CODE128 for non-EAN codes. */
export function barcodeSvg(code, { heightPx = 40, widthPx = 1.6, fontSize = 10 } = {}) {
  if (typeof document === "undefined") return "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const value = String(code || "");
  const ean = isEan13(value);
  try {
    JsBarcode(svg, value, {
      format: ean ? "EAN13" : "CODE128",
      width: widthPx,
      height: heightPx,
      displayValue: true,
      fontSize,
      textMargin: 1,
      margin: 0,
      flat: true,
    });
  } catch {
    // Invalid EAN check digit etc. — fall back to CODE128 so the label still prints
    JsBarcode(svg, value, {
      format: "CODE128",
      width: widthPx,
      height: heightPx,
      displayValue: true,
      fontSize,
      textMargin: 1,
      margin: 0,
    });
  }
  // JsBarcode emits fixed px width/height but no viewBox; add one so the SVG
  // scales to its container instead of overflowing at native size.
  const w = parseFloat(svg.getAttribute("width")) || 0;
  const h = parseFloat(svg.getAttribute("height")) || 0;
  if (w && h) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg.outerHTML;
}

function labelHtml({ name, price, svg }) {
  return `<div class="label">
  <div class="name">${esc(name)}</div>
  <div class="price">${esc(money(price))}</div>
  <div class="code">${svg}</div>
</div>`;
}

/**
 * Build a single print document for one or many batches.
 * Accepts `batch` (single) or `batches` (array); each contributes `quantity` labels.
 */
export function buildBarcodeLabelsHtml({ batch, batches, layoutKey = DEFAULT_LAYOUT, copies }) {
  const layout = LABEL_LAYOUTS[layoutKey] || LABEL_LAYOUTS[DEFAULT_LAYOUT];
  const list = Array.isArray(batches) && batches.length ? batches : batch ? [batch] : [];
  if (!list.length) throw new Error("Nothing to print");
  const title = list.length === 1 ? list[0].product_name : `${list.length} products`;
  const labels = list
    .map((b) => {
      const count = Math.max(1, Number(copies ?? b?.quantity ?? 1));
      const one = labelHtml({ name: b.product_name, price: b.price, svg: barcodeSvg(b.barcode) });
      return Array.from({ length: count }, () => one).join("\n");
    })
    .join("\n");

  const pageCss =
    layout.kind === "roll"
      ? `@page { size: ${layout.w}mm ${layout.h}mm; margin: 0; }
    .sheet { display: block; }
    .label { width: ${layout.w}mm; height: ${layout.h}mm; page-break-after: always; break-after: page; }`
      : `@page { size: A4; margin: 8mm 6mm; }
    .sheet { display: grid; grid-template-columns: repeat(${layout.cols}, ${layout.w}mm); justify-content: center; column-gap: 2mm; row-gap: 0; }
    .label { width: ${layout.w}mm; height: ${layout.h}mm; break-inside: avoid; }`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Labels · ${esc(title)}</title>
  <style>
    ${pageCss}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .label {
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      padding: 1mm 1.5mm; overflow: hidden; text-align: center;
    }
    .name { font-size: 8pt; font-weight: 700; line-height: 1.1; max-height: 2.2em; overflow: hidden;
      width: 100%; word-break: break-word; flex: 0 0 auto; }
    .price { font-size: 7.5pt; margin-top: 0.3mm; flex: 0 0 auto; white-space: nowrap; }
    .code { width: 100%; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; margin-top: 0.5mm; }
    .code svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <div class="sheet">
${labels}
  </div>
</body>
</html>`;
}

const FRAME_ID = "zetro-label-print-frame";

/** Print labels via hidden iframe. Resolves when the print dialog has been opened. */
export function printBarcodeLabels(opts) {
  const html = buildBarcodeLabelsHtml(opts);
  let frame = document.getElementById(FRAME_ID);
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = FRAME_ID;
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(frame);
  }

  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc || !frame.contentWindow) {
    throw new Error("Could not prepare print view");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      throw new Error(err?.message || "Print failed");
    }
  };

  if (frame.contentDocument?.readyState === "complete") {
    setTimeout(runPrint, 80);
  } else {
    frame.onload = () => setTimeout(runPrint, 80);
  }
}
