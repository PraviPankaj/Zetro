"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, InputGroup } from "react-bootstrap";
import { COMMON_GST_SLABS, formatRate } from "./GstRateSelect";

function normalize(value) {
  return {
    gst_enabled: !!value?.gst_enabled,
    gst_rate: Number(value?.gst_rate ?? 18),
    gst_rates: Array.isArray(value?.gst_rates) ? value.gst_rates.map(Number) : [],
  };
}

/**
 * Shared GST slabs editor used by shop admin Settings and platform shop settings.
 * `value = { gst_enabled, gst_rate, gst_rates }`
 * `onSave(payload)` should return the saved GST fields (or void).
 */
export default function GstSettingsForm({ value, onSave, showIntro = true }) {
  const [gst, setGst] = useState(() => normalize(value));
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const ratesKey = Array.isArray(value?.gst_rates) ? value.gst_rates.join(",") : "";
  useEffect(() => {
    setGst(normalize(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when parent shop GST payload changes
  }, [value?.gst_enabled, value?.gst_rate, ratesKey]);

  function addRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("GST rate must be between 0 and 100");
      return;
    }
    setError("");
    setGst((g) => {
      const rates = g.gst_rates.includes(n) ? g.gst_rates : [...g.gst_rates, n].sort((a, b) => a - b);
      return { ...g, gst_rates: rates, gst_rate: rates.includes(Number(g.gst_rate)) ? g.gst_rate : rates[0] };
    });
    setNewRate("");
  }

  function removeRate(rate) {
    setGst((g) => {
      const rates = g.gst_rates.filter((r) => r !== rate);
      return {
        ...g,
        gst_rates: rates,
        gst_rate: rates.length && !rates.includes(Number(g.gst_rate)) ? rates[0] : g.gst_rate,
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await onSave({
        gst_enabled: gst.gst_enabled,
        gst_rate: Number(gst.gst_rate) || 0,
        gst_rates: gst.gst_rates.map(Number),
      });
      if (result) setGst(normalize(result));
      setMessage("GST settings saved");
    } catch (err) {
      setError(err.message || "Failed to save GST settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {showIntro ? (
        <p className="text-muted">
          Control GST on in-shop billing. Add the GST slabs this shop sells under; each product can then
          pick its own rate (in Products, Stock or the Barcode generator). Products without a rate use the
          default.
        </p>
      ) : null}
      <Form.Check
        type="switch"
        className="mb-3"
        id="gst-enabled"
        label="Enable GST on shop bills"
        checked={!!gst.gst_enabled}
        onChange={(e) => setGst({ ...gst, gst_enabled: e.target.checked })}
      />

      <Form.Group className="mb-3">
        <Form.Label>GST slabs used by this shop</Form.Label>
        <div className="d-flex flex-wrap gap-2 mb-2">
          {gst.gst_rates.length ? (
            gst.gst_rates.map((r) => (
              <Badge
                key={r}
                bg={Number(gst.gst_rate) === r ? "primary" : "light"}
                text={Number(gst.gst_rate) === r ? undefined : "dark"}
                className="d-inline-flex align-items-center gap-2 border"
                style={{ fontSize: 14, padding: "6px 10px" }}
              >
                {formatRate(r)}
                {Number(gst.gst_rate) === r ? <span className="small fw-normal">· default</span> : null}
                <button
                  type="button"
                  className={`btn-close ${Number(gst.gst_rate) === r ? "btn-close-white" : ""}`}
                  style={{ fontSize: 9 }}
                  aria-label={`Remove ${formatRate(r)}`}
                  onClick={() => removeRate(r)}
                />
              </Badge>
            ))
          ) : (
            <span className="text-muted small">
              No slabs yet — add the ones you use, or pick from the common slabs below.
            </span>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <InputGroup style={{ maxWidth: 220 }}>
            <Form.Control
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="e.g. 12"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newRate !== "") addRate(newRate);
                }
              }}
            />
            <InputGroup.Text>%</InputGroup.Text>
            <Button variant="outline-primary" type="button" disabled={newRate === ""} onClick={() => addRate(newRate)}>
              Add
            </Button>
          </InputGroup>
          <span className="text-muted small">Quick add:</span>
          {COMMON_GST_SLABS.filter((r) => !gst.gst_rates.includes(r)).map((r) => (
            <Button key={r} size="sm" variant="outline-secondary" type="button" onClick={() => addRate(r)}>
              {formatRate(r)}
            </Button>
          ))}
        </div>
      </Form.Group>

      <Form.Group className="mb-3" style={{ maxWidth: 260 }}>
        <Form.Label>Default GST rate</Form.Label>
        {gst.gst_rates.length ? (
          <Form.Select
            value={String(Number(gst.gst_rate))}
            onChange={(e) => setGst({ ...gst, gst_rate: Number(e.target.value) })}
          >
            {gst.gst_rates.map((r) => (
              <option key={r} value={String(r)}>
                {formatRate(r)}
              </option>
            ))}
          </Form.Select>
        ) : (
          <InputGroup>
            <Form.Control
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={gst.gst_rate}
              onChange={(e) => setGst({ ...gst, gst_rate: e.target.value })}
            />
            <InputGroup.Text>%</InputGroup.Text>
          </InputGroup>
        )}
        <Form.Text muted>Applied to products that don&apos;t set their own GST %.</Form.Text>
      </Form.Group>
      <p className="small text-muted">
        Bills always round to the nearest rupee. GST is charged per line at each product&apos;s rate and shown
        as a breakup on the receipt.
      </p>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save GST settings"}
      </Button>
    </Form>
  );
}
