"use client";

import { Form } from "react-bootstrap";

/** Common Indian GST slabs offered when a shop hasn't configured its own list. */
export const COMMON_GST_SLABS = [0, 5, 12, 18, 28];

export function formatRate(rate) {
  const n = Number(rate);
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** Normalise `/info` or platform ShopOut into what pickers need. */
export function gstOptionsFromShop(shop) {
  const rates = Array.isArray(shop?.gst_rates) && shop.gst_rates.length
    ? shop.gst_rates.map(Number)
    : [];
  return {
    enabled: Boolean(shop?.gst_enabled),
    defaultRate: Number(shop?.gst_rate ?? 0),
    rates,
  };
}

/**
 * Select a GST % for a product.
 * `value` is "" (use shop default), or a number/string rate.
 * `onChange(rateOrNull)` receives `null` for shop default.
 */
export default function GstRateSelect({
  value,
  onChange,
  gst,
  size,
  disabled,
  className,
  id,
  label = "GST %",
  showLabel = true,
  style,
}) {
  const options = gst?.rates?.length ? gst.rates : COMMON_GST_SLABS;
  const current = value === null || value === undefined || value === "" ? "" : String(Number(value));
  // Keep an unusual existing value selectable even if it's not in the slab list
  const extra = current !== "" && !options.some((r) => String(Number(r)) === current) ? [Number(current)] : [];
  const all = [...options, ...extra].sort((a, b) => a - b);

  const control = (
    <Form.Select
      id={id}
      size={size}
      disabled={disabled}
      className={className}
      style={style}
      value={current}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      <option value="">
        Shop default{gst ? ` (${formatRate(gst.defaultRate)})` : ""}
      </option>
      {all.map((r) => (
        <option key={r} value={String(Number(r))}>
          {formatRate(r)}
        </option>
      ))}
    </Form.Select>
  );

  if (!showLabel) return control;
  return (
    <Form.Group>
      <Form.Label>{label}</Form.Label>
      {control}
      {gst && !gst.enabled ? (
        <Form.Text muted>GST is off in Settings — rates are stored but not charged.</Form.Text>
      ) : null}
    </Form.Group>
  );
}
