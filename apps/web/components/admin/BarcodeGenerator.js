"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, ListGroup, Modal, Row, Table } from "react-bootstrap";
import GstRateSelect, { formatRate, gstOptionsFromShop } from "./GstRateSelect";
import {
  DEFAULT_LAYOUT,
  LABEL_LAYOUTS,
  barcodeSvg,
  money,
  printBarcodeLabels,
} from "../../lib/printBarcodeLabels";

const STATUS_VARIANT = { draft: "secondary", printed: "success", cancelled: "danger" };

function StatusBadge({ status }) {
  return <Badge bg={STATUS_VARIANT[status] || "secondary"}>{status}</Badge>;
}

/** On-screen mock of one label, same proportions as the chosen layout. */
function LabelPreview({ name, price, barcode, layoutKey, width = 220 }) {
  const layout = LABEL_LAYOUTS[layoutKey] || LABEL_LAYOUTS[DEFAULT_LAYOUT];
  const svg = useMemo(() => (barcode ? barcodeSvg(barcode) : ""), [barcode]);
  const height = Math.round((width * layout.h) / layout.w);
  return (
    <div
      className="border rounded bg-white d-flex flex-column align-items-center text-center"
      style={{ width, height, maxWidth: "100%", padding: "6px 8px", overflow: "hidden" }}
    >
      <div
        className="fw-bold w-100"
        style={{ fontSize: 12, lineHeight: 1.1, maxHeight: "2.2em", overflow: "hidden", flex: "0 0 auto" }}
      >
        {name || "Product name"}
      </div>
      <div style={{ fontSize: 11, flex: "0 0 auto", whiteSpace: "nowrap" }}>{money(price)}</div>
      {svg ? (
        <div
          className="w-100 label-preview-code"
          style={{ flex: "1 1 auto", minHeight: 0, marginTop: 2 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="text-muted small mt-2">Barcode appears after generating</div>
      )}
    </div>
  );
}

let rowSeq = 0;

/**
 * Barcode label generator. Works for shop admin and platform admin via `barcodeApi`
 * (see createShopBarcodeApi / createPlatformBarcodeApi in lib/catalogApi.js).
 */
export default function BarcodeGenerator({
  barcodeApi,
  title = "Barcode generator",
  subtitle,
  headerActions,
}) {
  const [gst, setGst] = useState(null);

  // --- form for one product ---
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [barcode, setBarcode] = useState("");
  const [gstRate, setGstRate] = useState(null); // null = shop default
  const [productId, setProductId] = useState(null);
  const [layoutKey, setLayoutKey] = useState(DEFAULT_LAYOUT);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef(null);
  const searchTimer = useRef(null);

  // --- products queued for this print run (not yet saved) ---
  const [pending, setPending] = useState([]);

  // --- generated draft batches for the current run ---
  const [printSet, setPrintSet] = useState([]);

  // --- recent batches + multi-select ---
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  const [editing, setEditing] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null); // batch | { many: [batches] }

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBatches = useCallback(async () => {
    try {
      const list = await barcodeApi.list();
      setBatches(list || []);
      setSelected((prev) => {
        const alive = new Set((list || []).filter((b) => b.status !== "cancelled").map((b) => b.id));
        return new Set([...prev].filter((id) => alive.has(id)));
      });
    } catch (err) {
      setError(err.message);
    }
  }, [barcodeApi]);

  useEffect(() => {
    loadBatches();
    barcodeApi
      .shopInfo()
      .then((info) => setGst(gstOptionsFromShop(info)))
      .catch(() => setGst(null));
    nameRef.current?.focus();
  }, [barcodeApi, loadBatches]);

  // Autocomplete existing products by name
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = name.trim();
    if (q.length < 2 || productId) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const rows = await barcodeApi.search(q);
        setSuggestions(rows || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [name, productId, barcodeApi]);

  function pickProduct(p) {
    setProductId(p.product_id);
    setName(p.name);
    setPrice(String(p.price ?? ""));
    setBarcode(p.barcode || "");
    setGstRate(p.gst_rate ?? null);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function resetForm(focus = true) {
    setName("");
    setPrice("");
    setQuantity("10");
    setBarcode("");
    setGstRate(null);
    setProductId(null);
    setSuggestions([]);
    if (focus) setTimeout(() => nameRef.current?.focus(), 50);
  }

  function rowFromForm() {
    return {
      key: `r${++rowSeq}`,
      name: name.trim(),
      price: Number(price) || 0,
      quantity: Math.max(1, Number(quantity) || 1),
      barcode: barcode.trim() || null,
      product_id: productId || null,
      gst_rate: gstRate,
    };
  }

  // ---- queue management ----
  function addToList(e) {
    e?.preventDefault();
    if (!name.trim()) return;
    setError("");
    setPending((prev) => [...prev, rowFromForm()]);
    resetForm();
  }

  function updatePending(key, patch) {
    setPending((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removePending(key) {
    setPending((prev) => prev.filter((r) => r.key !== key));
  }

  const pendingLabels = pending.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  async function generateAll() {
    // Include whatever is still typed in the form so one-product use is a single click
    const rows = [...pending];
    if (name.trim()) rows.push(rowFromForm());
    if (!rows.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    const created = [];
    const failed = [];
    for (const row of rows) {
      try {
        const b = await barcodeApi.create({
          name: row.name,
          price: Number(row.price) || 0,
          quantity: Math.max(1, Number(row.quantity) || 1),
          barcode: row.barcode || undefined,
          product_id: row.product_id || undefined,
          gst_rate: row.gst_rate === null || row.gst_rate === "" ? undefined : Number(row.gst_rate),
        });
        created.push(b);
      } catch (err) {
        failed.push(`${row.name}: ${err.message}`);
      }
    }
    setBusy(false);
    setPrintSet(created);
    setPending(rows.filter((r) => failed.some((f) => f.startsWith(`${r.name}:`))));
    resetForm(false);
    const total = created.reduce((s, b) => s + b.quantity, 0);
    if (created.length) {
      setMessage(
        `Generated ${total} label${total === 1 ? "" : "s"} for ${created.length} product${
          created.length === 1 ? "" : "s"
        } (saved as draft — stock is added when you print).`
      );
    }
    if (failed.length) setError(`Could not generate: ${failed.join(" · ")}`);
    await loadBatches();
  }

  // ---- printing ----
  function doPrint(list) {
    try {
      printBarcodeLabels({ batches: list, layoutKey });
    } catch (err) {
      setError(err.message || "Could not open print dialog");
    }
  }

  /** Mark each batch printed (adds stock to drafts once) then print them all in one job. */
  async function printBatches(list) {
    const targets = (list || []).filter((b) => b && b.status !== "cancelled");
    if (!targets.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    const updated = [];
    const failed = [];
    let added = 0;
    for (const b of targets) {
      try {
        const u = await barcodeApi.print(b.id);
        if (b.status === "draft") added += u.quantity;
        updated.push(u);
      } catch (err) {
        failed.push(`${b.product_name}: ${err.message}`);
      }
    }
    setBusy(false);
    if (updated.length) {
      const labels = updated.reduce((s, u) => s + u.quantity, 0);
      setMessage(
        `Printing ${labels} labels for ${updated.length} product${updated.length === 1 ? "" : "s"}` +
          (added ? ` · ${added} added to stock.` : " · reprint, stock unchanged.")
      );
      setPrintSet((prev) => {
        const byId = new Map(updated.map((u) => [u.id, u]));
        return prev.length ? prev.map((p) => byId.get(p.id) || p) : prev;
      });
      setTimeout(() => doPrint(updated), 100);
    }
    if (failed.length) setError(`Could not print: ${failed.join(" · ")}`);
    await loadBatches();
  }

  // ---- cancel ----
  async function confirmCancel() {
    const target = cancelTarget;
    if (!target) return;
    const list = target.many ? target.many : [target];
    setBusy(true);
    setError("");
    setMessage("");
    let removed = 0;
    const failed = [];
    for (const b of list) {
      try {
        await barcodeApi.cancel(b.id);
        removed += b.stock_applied || 0;
      } catch (err) {
        failed.push(`${b.product_name}: ${err.message}`);
      }
    }
    setBusy(false);
    setCancelTarget(null);
    setMessage(
      `Cancelled ${list.length} batch${list.length === 1 ? "" : "es"}` +
        (removed ? ` · ${removed} removed from stock.` : " · stock unchanged.")
    );
    if (failed.length) setError(`Could not cancel: ${failed.join(" · ")}`);
    const ids = new Set(list.map((b) => b.id));
    setPrintSet((prev) => prev.filter((p) => !ids.has(p.id)));
    await loadBatches();
  }

  // ---- edit ----
  function openEdit(batch) {
    setEditing(batch);
    setEditPrice(String(batch.price));
    setEditQty(String(batch.quantity));
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {};
      if (Number(editPrice) !== Number(editing.price)) payload.price = Number(editPrice);
      if (Number(editQty) !== Number(editing.quantity)) payload.quantity = Number(editQty);
      if (!Object.keys(payload).length) {
        setEditing(null);
        return;
      }
      const updated = await barcodeApi.update(editing.id, payload);
      const notes = [];
      if (payload.quantity !== undefined) {
        notes.push(
          updated.status === "printed"
            ? `stock adjusted to ${updated.current_stock}`
            : "quantity updated (draft, no stock change)"
        );
      }
      if (payload.price !== undefined) {
        notes.push(
          updated.status === "printed"
            ? `selling price now ${money(updated.current_price)} — reprint so labels match`
            : "price updated"
        );
      }
      setMessage(`Updated “${updated.product_name}”: ${notes.join("; ")}.`);
      setPrintSet((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing(null);
      await loadBatches();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ---- selection in recent table ----
  const selectable = batches.filter((b) => b.status !== "cancelled");
  const selectedBatches = selectable.filter((b) => selected.has(b.id));
  const allSelected = selectable.length > 0 && selectedBatches.length === selectable.length;

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((b) => b.id)));
  }

  const printSetLabels = printSet.reduce((s, b) => s + b.quantity, 0);
  const printSetDrafts = printSet.filter((b) => b.status === "draft");
  const printSetAddsStock = printSetDrafts.reduce((s, b) => s + b.quantity, 0);
  const canGenerate = pending.length > 0 || name.trim().length > 0;

  return (
    <>
      <div className="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h2 className="mb-1">{title}</h2>
          <p className="text-muted mb-0">
            {subtitle ||
              "Add one or more products, then generate and print all their labels in a single run. Printing adds the label count to stock; cancelling a printed batch removes it again."}
          </p>
        </div>
        {headerActions}
      </div>

      {message ? (
        <Alert variant="success" onClose={() => setMessage("")} dismissible>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      ) : null}

      <Row className="g-4">
        <Col lg={7}>
          <Card className="mb-4">
            <Card.Header>Products for this print run</Card.Header>
            <Card.Body>
              <Form onSubmit={addToList} autoComplete="off">
                <Row className="g-3">
                  <Col md={12} style={{ position: "relative" }}>
                    <Form.Group>
                      <Form.Label>Product name</Form.Label>
                      <Form.Control
                        ref={nameRef}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (productId) setProductId(null);
                        }}
                        onFocus={() => suggestions.length && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        placeholder="Type to search existing products or enter a new name"
                      />
                      {productId ? (
                        <div className="small mt-1">
                          Linked to existing product{barcode ? ` · barcode ${barcode}` : ""}.{" "}
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 align-baseline"
                            onClick={() => {
                              setProductId(null);
                              setBarcode("");
                            }}
                          >
                            Create as new instead
                          </Button>
                        </div>
                      ) : null}
                    </Form.Group>
                    {showSuggestions && suggestions.length ? (
                      <ListGroup
                        className="shadow position-absolute w-100"
                        style={{ zIndex: 20, top: "100%", maxHeight: 260, overflowY: "auto" }}
                      >
                        {suggestions.map((p) => (
                          <ListGroup.Item
                            key={p.variant_id}
                            action
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickProduct(p)}
                            className="d-flex justify-content-between align-items-center"
                          >
                            <div>
                              <div className="fw-semibold">{p.name}</div>
                              <div className="text-muted small">
                                {p.barcode || "no barcode"} · stock {p.stock}
                              </div>
                            </div>
                            <div>{money(p.price)}</div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    ) : null}
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Price (₹)</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Labels (stock)</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        max={5000}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <GstRateSelect value={gstRate} onChange={setGstRate} gst={gst} />
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Barcode (optional)</Form.Label>
                      <Form.Control
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Auto-generate"
                        disabled={Boolean(productId)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex gap-2 mt-3 flex-wrap align-items-center">
                  <Button type="submit" variant="outline-primary" disabled={busy || !name.trim()}>
                    + Add to list
                  </Button>
                  <Button type="button" variant="link" size="sm" onClick={() => resetForm()} disabled={busy}>
                    Clear fields
                  </Button>
                </div>
              </Form>

              {pending.length ? (
                <Table size="sm" className="mt-3 mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: 120 }}>Price</th>
                      <th style={{ width: 150 }}>GST</th>
                      <th style={{ width: 100 }}>Labels</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.key}>
                        <td>
                          <div className="fw-semibold">{r.name}</div>
                          <div className="text-muted small">
                            {r.product_id ? `existing · ${r.barcode || "new barcode"}` : r.barcode || "new barcode"}
                          </div>
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={0}
                            step="0.01"
                            value={r.price}
                            onChange={(e) => updatePending(r.key, { price: e.target.value })}
                          />
                        </td>
                        <td>
                          <GstRateSelect
                            size="sm"
                            showLabel={false}
                            value={r.gst_rate}
                            gst={gst}
                            onChange={(v) => updatePending(r.key, { gst_rate: v })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={1}
                            max={5000}
                            value={r.quantity}
                            onChange={(e) => updatePending(r.key, { quantity: e.target.value })}
                          />
                        </td>
                        <td className="text-end">
                          <Button size="sm" variant="outline-danger" onClick={() => removePending(r.key)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : null}

              <hr />
              <Row className="g-3 align-items-end">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Label layout</Form.Label>
                    <Form.Select value={layoutKey} onChange={(e) => setLayoutKey(e.target.value)}>
                      {Object.entries(LABEL_LAYOUTS).map(([key, l]) => (
                        <option key={key} value={key}>
                          {l.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex justify-content-md-end">
                  <Button onClick={generateAll} disabled={busy || !canGenerate}>
                    {busy
                      ? "Working…"
                      : `Generate labels${
                          pending.length || name.trim()
                            ? ` (${pending.length + (name.trim() ? 1 : 0)} product${
                                pending.length + (name.trim() ? 1 : 0) === 1 ? "" : "s"
                              }${pendingLabels || quantity ? `, ${pendingLabels + (name.trim() ? Number(quantity) || 0 : 0)} labels` : ""})`
                            : ""
                        }`}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Label preview</span>
              {printSet.length ? (
                <span className="text-muted small">
                  {printSet.length} product{printSet.length === 1 ? "" : "s"} · {printSetLabels} labels
                </span>
              ) : null}
            </Card.Header>
            <Card.Body>
              {printSet.length ? (
                <>
                  <div className="d-flex flex-wrap gap-3 justify-content-center mb-3">
                    {printSet.map((b) => (
                      <div key={b.id} className="text-center">
                        <LabelPreview
                          name={b.product_name}
                          price={b.price}
                          barcode={b.barcode}
                          layoutKey={layoutKey}
                          width={printSet.length > 1 ? 180 : 240}
                        />
                        <div className="small text-muted mt-1">
                          ×{b.quantity} · <StatusBadge status={b.status} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {printSetDrafts.length ? (
                    <>
                      <Button className="w-100 mb-2" disabled={busy} onClick={() => printBatches(printSet)}>
                        Save &amp; print all — adds {printSetAddsStock} to stock
                      </Button>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          className="flex-fill"
                          disabled={busy}
                          onClick={() => {
                            setPrintSet([]);
                            setMessage("Drafts kept. Print them later from Recent batches.");
                          }}
                        >
                          Keep as drafts
                        </Button>
                        <Button
                          variant="outline-danger"
                          className="flex-fill"
                          disabled={busy}
                          onClick={() => setCancelTarget({ many: printSet })}
                        >
                          Discard all
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline-primary"
                        className="w-100 mb-2"
                        disabled={busy}
                        onClick={() => printBatches(printSet)}
                      >
                        Reprint all (no stock change)
                      </Button>
                      <Button
                        variant="outline-secondary"
                        className="w-100"
                        disabled={busy}
                        onClick={() => {
                          setPrintSet([]);
                          resetForm();
                        }}
                      >
                        Start new run
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <div className="d-flex flex-column align-items-center gap-3">
                  <LabelPreview name={name} price={price} barcode={barcode} layoutKey={layoutKey} width={240} />
                  <div className="text-muted small text-center">
                    Add products to the list, then click <strong>Generate labels</strong> to preview and print
                    them together.
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Card className="admin-table-card">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>Recent batches</span>
              <div className="d-flex gap-2">
                {selectedBatches.length ? (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => printBatches(selectedBatches)}
                    >
                      Print selected ({selectedBatches.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={busy}
                      onClick={() => setCancelTarget({ many: selectedBatches })}
                    >
                      Cancel selected
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="outline-secondary" onClick={loadBatches} disabled={busy}>
                  Refresh
                </Button>
              </div>
            </Card.Header>
            <Table responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <Form.Check
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={!selectable.length}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Price</th>
                  <th>Labels</th>
                  <th>Status</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.length ? (
                  batches.map((b) => (
                    <tr key={b.id} className={printSet.some((p) => p.id === b.id) ? "table-active" : ""}>
                      <td>
                        {b.status !== "cancelled" ? (
                          <Form.Check
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            aria-label={`Select ${b.product_name}`}
                          />
                        ) : null}
                      </td>
                      <td>
                        <div className="fw-semibold">{b.product_name}</div>
                        <div className="text-muted small text-nowrap">
                          {new Date(b.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {b.print_count > 1 ? ` · printed ${b.print_count}×` : ""}
                        </div>
                      </td>
                      <td className="font-monospace small">{b.barcode}</td>
                      <td>
                        {money(b.price)}
                        {b.gst_rate !== null && b.gst_rate !== undefined ? (
                          <div className="text-muted small">GST {formatRate(b.gst_rate)}</div>
                        ) : null}
                        {b.status === "printed" && Number(b.current_price) !== Number(b.price) ? (
                          <div className="text-warning small">selling at {money(b.current_price)}</div>
                        ) : null}
                      </td>
                      <td>{b.quantity}</td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td>{b.current_stock}</td>
                      <td className="text-end text-nowrap">
                        {b.status !== "cancelled" ? (
                          <>
                            <Button
                              size="sm"
                              variant={b.status === "draft" ? "primary" : "outline-primary"}
                              className="me-1"
                              disabled={busy}
                              onClick={() => printBatches([b])}
                            >
                              {b.status === "draft" ? "Print & add stock" : "Reprint"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              className="me-1"
                              disabled={busy}
                              onClick={() => openEdit(b)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={busy}
                              onClick={() => setCancelTarget(b)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted small">
                            {b.cancelled_at ? new Date(b.cancelled_at).toLocaleDateString("en-IN") : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-muted text-center py-4">
                      No label batches yet
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit batch · {editing?.product_name}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editing?.status === "printed" ? (
              <Alert variant="warning" className="small">
                This batch is already printed. Changing quantity adjusts stock immediately; changing price
                updates the selling price (reprint labels so they match).
              </Alert>
            ) : null}
            <Row className="g-3">
              <Col sm={6}>
                <Form.Group>
                  <Form.Label>Price (₹)</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group>
                  <Form.Label>Labels / stock</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={5000}
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)} disabled={busy}>
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(cancelTarget)} onHide={() => setCancelTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {cancelTarget?.many ? `Cancel ${cancelTarget.many.length} batches?` : "Cancel batch?"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(() => {
            const list = cancelTarget?.many || (cancelTarget ? [cancelTarget] : []);
            const applied = list.reduce((s, b) => s + (b.stock_applied || 0), 0);
            if (applied > 0) {
              return (
                <>
                  These batches added <strong>{applied}</strong> units to stock. Cancelling removes them again
                  (stock won&apos;t go below zero). Labels already printed should be discarded.
                </>
              );
            }
            return (
              <>
                Discard {list.length === 1 ? <strong>{list[0]?.product_name}</strong> : "these drafts"}? Stock was
                never changed.
              </>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setCancelTarget(null)} disabled={busy}>
            Keep
          </Button>
          <Button variant="danger" onClick={confirmCancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
