/**
 * Thermal printer receipt (80mm roll). Print → choose thermal printer.
 * Uses @page width so browsers don't default to A4.
 */

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Roll width in mm — 80 is standard; 58 for smaller printers. */
const THERMAL_WIDTH_MM = 80;

export function buildBillReceiptHtml({ shop, bill, customerName, customerPhone, widthMm = THERMAL_WIDTH_MM }) {
  const address = bill?.shipping_address || {};
  const name = customerName || address.name || "Walk-in";
  const phone = customerPhone || address.phone || "";
  const items = bill?.items || [];
  const when = bill?.created_at ? new Date(bill.created_at).toLocaleString("en-IN") : "";
  const contentMm = Math.max(48, Number(widthMm) - 6);

  const rows = items
    .map(
      (item) => `
      <tr>
        <td class="item">${esc(item.product_name)}${
          item.variant_name && item.variant_name !== "Default"
            ? `<div class="muted">${esc(item.variant_name)}</div>`
            : ""
        }</td>
        <td class="num">${esc(item.quantity)}</td>
        <td class="num">${money(item.unit_price)}</td>
        <td class="num">${money(item.line_total)}</td>
      </tr>`
    )
    .join("");

  const gstRow =
    Number(bill?.tax_amount) > 0
      ? `<div class="row"><span>GST</span><span>${money(bill.tax_amount)}</span></div>`
      : `<div class="row muted"><span>GST</span><span>Nil</span></div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill ${esc(bill?.order_number || "")}</title>
  <style>
    @page {
      size: ${widthMm}mm auto;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${widthMm}mm;
      background: #fff;
      color: #000;
      font-family: "Courier New", Courier, ui-monospace, monospace;
      font-size: 11px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket {
      width: ${contentMm}mm;
      max-width: ${contentMm}mm;
      margin: 0 auto;
      padding: 2mm 1.5mm 4mm;
    }
    h1 {
      font-size: 14px;
      margin: 0 0 2px;
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      word-break: break-word;
    }
    .sub { text-align: center; margin: 0 0 6px; font-size: 10px; }
    .dash {
      border: 0;
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .meta div { margin: 1px 0; word-break: break-word; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      table-layout: fixed;
    }
    th, td {
      padding: 2px 0;
      vertical-align: top;
      font-size: 10px;
    }
    th {
      text-align: left;
      border-bottom: 1px solid #000;
      font-weight: 700;
      padding-bottom: 3px;
    }
    th.num, td.num {
      text-align: right;
      white-space: nowrap;
      width: 18%;
    }
    th.qty, td.qty { width: 10%; }
    td.item { width: 46%; word-break: break-word; padding-right: 2px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin: 2px 0;
      font-size: 11px;
    }
    .total {
      font-size: 13px;
      font-weight: 700;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #000;
    }
    .muted { color: #222; font-size: 9px; }
    .foot {
      text-align: center;
      margin-top: 8px;
      font-size: 10px;
    }
    @media print {
      html, body {
        width: ${widthMm}mm;
      }
      .ticket {
        width: ${contentMm}mm;
        padding: 1mm 1mm 3mm;
      }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <h1>${esc(shop?.name || "Shop")}</h1>
    <div class="sub">CASH BILL</div>
    <hr class="dash" />
    <div class="meta">
      <div>Bill: ${esc(bill?.order_number || "")}</div>
      <div>${esc(when)}</div>
      <div>Cust: ${esc(name)}${phone ? ` / ${esc(phone)}` : ""}</div>
      ${bill?.notes ? `<div>Note: ${esc(bill.notes)}</div>` : ""}
    </div>
    <hr class="dash" />
    <table>
      <thead>
        <tr>
          <th class="item">Item</th>
          <th class="num qty">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amt</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="dash" />
    <div class="row"><span>Subtotal</span><span>${money(bill?.subtotal)}</span></div>
    ${gstRow}
    <div class="row"><span>Round off</span><span>${money(bill?.round_off)}</span></div>
    <div class="row total"><span>TOTAL</span><span>${money(bill?.total)}</span></div>
    <hr class="dash" />
    <div class="foot">Paid · Thank you</div>
  </div>
</body>
</html>`;
}

const FRAME_ID = "zetro-bill-print-frame";

/** Print via hidden iframe sized for thermal roll (no pop-up / no A4 layout). */
export function printBillReceipt(opts) {
  const html = buildBillReceiptHtml(opts);
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
    setTimeout(runPrint, 50);
  } else {
    frame.onload = () => setTimeout(runPrint, 50);
  }
}
