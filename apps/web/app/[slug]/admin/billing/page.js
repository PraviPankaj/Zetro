"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Form, ListGroup, Row, Table } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";
import { printBillReceipt } from "../../../../lib/printBillReceipt";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Hardware scanners send digit-heavy codes; names are treated as search. */
function looksLikeBarcode(value) {
  const v = String(value || "").trim();
  if (v.length < 6) return false;
  return /^[0-9A-Za-z\-]+$/.test(v) && /[0-9]/.test(v) && !/\s/.test(v);
}

export default function BillingPage() {
  const { slug } = useParams();
  const inputRef = useRef(null);
  const [shop, setShop] = useState(null);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState(null);
  const [lastBill, setLastBill] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const searchTimer = useRef(null);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    api.shop(slug).info().then(setShop);
    inputRef.current?.focus();
  }, [slug]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await api.shop(slug).productSearch(q, getToken("shop", slug));
        setResults(rows || []);
        setHighlight(0);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [query, slug]);

  function addLine({ variant_id, product_name, barcode: code, unit_price, stock }) {
    setLines((prev) => {
      const existing = prev.find((l) => l.variant_id === variant_id);
      if (existing) {
        return prev.map((l) => (l.variant_id === variant_id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        { variant_id, product_name, barcode: code, unit_price: Number(unit_price), quantity: 1, stock: Number(stock) },
      ];
    });
  }

  function clearQuery() {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function addFromSearch(p) {
    if (!p) return;
    if (Number(p.stock) <= 0) {
      setError(`“${p.name}” is out of stock (0). Add stock under Barcode stock or the Barcode generator first.`);
    } else {
      setError("");
    }
    addLine({
      variant_id: p.variant_id,
      product_name: p.name,
      barcode: p.barcode,
      unit_price: p.price,
      stock: p.stock,
    });
    clearQuery();
  }

  async function addByBarcodeLookup(code) {
    const product = await api.shop(slug).barcode.lookup(code, getToken("shop", slug));
    if (!product) return false;
    const variant = product.variants?.[0];
    if (!variant) {
      setError("Product has no sellable variant");
      return true;
    }
    setError("");
    addLine({
      variant_id: variant.id,
      product_name: product.name,
      barcode: product.barcode,
      unit_price: variant.price,
      stock: variant.stock,
    });
    clearQuery();
    return true;
  }

  async function addProduct(e) {
    e?.preventDefault?.();
    const code = query.trim();
    if (!code || busy) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const found = await addByBarcodeLookup(code);
      if (found) return;

      if (results.length) {
        addFromSearch(results[highlight] || results[0]);
        return;
      }

      // Search may not have returned yet (scanner Enter is fast) — fetch once
      const rows = await api.shop(slug).productSearch(code, getToken("shop", slug));
      if (rows?.length === 1) {
        addFromSearch(rows[0]);
        return;
      }
      if (rows?.length > 1) {
        setResults(rows);
        setHighlight(0);
        setShowResults(true);
        setError("Several products match — pick one from the list.");
        return;
      }
      setError(`No product for “${code}”. Try another barcode or name.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onQueryKeyDown(e) {
    if (e.key === "Escape") {
      setShowResults(false);
      return;
    }
    if (!showResults || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" && !looksLikeBarcode(query)) {
      // Name search: Enter adds highlighted result; barcodes still go through form submit → lookup
      e.preventDefault();
      addFromSearch(results[highlight]);
    }
  }

  useEffect(() => {
    if (!lines.length) {
      setPreview(null);
      return;
    }
    const token = getToken("shop", slug);
    api
      .shop(slug)
      .billing.preview(
        {
          items: lines.map((l) => ({
            variant_id: l.variant_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        },
        token
      )
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [lines, slug]);

  function updateQty(variantId, quantity) {
    const qty = Math.max(1, Number(quantity) || 1);
    setLines((prev) => prev.map((l) => (l.variant_id === variantId ? { ...l, quantity: qty } : l)));
  }

  function removeLine(variantId) {
    setLines((prev) => prev.filter((l) => l.variant_id !== variantId));
  }

  function openReceipt(bill, customer = {}) {
    try {
      printBillReceipt({
        shop,
        bill,
        customerName: customer.name,
        customerPhone: customer.phone,
      });
    } catch (err) {
      setError(err.message || "Could not open print dialog");
    }
  }

  async function checkout() {
    if (!lines.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    const customerSnapshot = { name: customerName, phone: customerPhone };
    try {
      const bill = await api.shop(slug).billing.create(
        {
          items: lines.map((l) => ({
            variant_id: l.variant_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          notes: notes || undefined,
        },
        getToken("shop", slug)
      );
      setLastBill(bill);
      setLines([]);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setMessage(`Bill ${bill.order_number} saved · ${money(bill.total)}`);
      setTimeout(() => openReceipt(bill, customerSnapshot), 100);
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const gstSlabs = Array.isArray(shop?.gst_rates) && shop.gst_rates.length
    ? shop.gst_rates
    : [Number(shop?.gst_rate || 0)];
  const gstLabel = shop?.gst_enabled
    ? gstSlabs.length > 1
      ? `GST per product (${gstSlabs.map((r) => `${Number(r)}%`).join(", ")}; default ${Number(
          shop.gst_rate || 0,
        )}%)`
      : `GST on (${Number(shop.gst_rate || 0)}%)`
    : "GST off (enable in Settings)";

  return (
    <>
      <div className="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h2 className="mb-1">Billing</h2>
          <p className="text-muted mb-0">
            In-shop sales — scan items, totals round to the nearest rupee. {gstLabel}.
          </p>
        </div>
        <Button variant="primary" disabled={busy || !lines.length} onClick={checkout}>
          {busy ? "Saving…" : "Complete bill"}
        </Button>
      </div>

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Row className="g-4">
        <Col lg={8}>
          <Card className="mb-3">
            <Card.Body>
              <Form onSubmit={addProduct}>
                <Form.Label>Add product</Form.Label>
                <div className="d-flex gap-2 flex-wrap align-items-start">
                  <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 520 }}>
                    <Form.Control
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onQueryKeyDown}
                      onFocus={() => results.length && setShowResults(true)}
                      onBlur={() => setTimeout(() => setShowResults(false), 150)}
                      placeholder="Scan barcode or type product name"
                      autoComplete="off"
                      style={{ fontSize: 18 }}
                    />
                    {showResults ? (
                      <ListGroup
                        className="shadow position-absolute w-100"
                        style={{ zIndex: 20, top: "100%", maxHeight: 300, overflowY: "auto" }}
                      >
                        {results.length ? (
                          results.map((p, idx) => (
                            <ListGroup.Item
                              key={p.variant_id}
                              action
                              active={idx === highlight}
                              onMouseDown={(e) => e.preventDefault()}
                              onMouseEnter={() => setHighlight(idx)}
                              onClick={() => addFromSearch(p)}
                              className="d-flex justify-content-between align-items-center"
                            >
                              <div>
                                <div className="fw-semibold">{p.name}</div>
                                <div className={`small ${idx === highlight ? "" : "text-muted"}`}>
                                  {p.barcode || "no barcode"} · stock {p.stock}
                                  {p.stock <= 0 ? " · out of stock" : ""}
                                </div>
                              </div>
                              <div className="fw-semibold">{money(p.price)}</div>
                            </ListGroup.Item>
                          ))
                        ) : (
                          <ListGroup.Item className="text-muted small">
                            {searching ? "Searching…" : `No products match “${query}”`}
                          </ListGroup.Item>
                        )}
                      </ListGroup>
                    ) : null}
                  </div>
                  <Button type="submit" disabled={busy || !query.trim()}>
                    Add
                  </Button>
                </div>
                <Form.Text muted>Scan a barcode or type a name — Enter adds the match.</Form.Text>
              </Form>
            </Card.Body>
          </Card>

          <Card className="admin-table-card">
            <Table responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Item</th>
                  <th>Barcode</th>
                  <th>Price</th>
                  <th style={{ width: 110 }}>Qty</th>
                  <th>Line</th>
                  {shop?.gst_enabled ? <th>GST</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.length ? (
                  lines.map((line) => (
                    <tr key={line.variant_id}>
                      <td>
                        <div className="fw-semibold">{line.product_name}</div>
                        <div className="text-muted small">Stock {line.stock}</div>
                      </td>
                      <td className="font-monospace small">{line.barcode || "—"}</td>
                      <td>{money(line.unit_price)}</td>
                      <td>
                        <Form.Control
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateQty(line.variant_id, e.target.value)}
                        />
                      </td>
                      <td>{money(line.unit_price * line.quantity)}</td>
                      {shop?.gst_enabled ? (
                        <td className="text-nowrap">
                          {(() => {
                            const pv = preview?.items?.find((i) => i.variant_id === line.variant_id);
                            if (!pv) return <span className="text-muted">—</span>;
                            return (
                              <>
                                <div>{money(pv.tax_amount)}</div>
                                <div className="text-muted small">@ {Number(pv.gst_rate)}%</div>
                              </>
                            );
                          })()}
                        </td>
                      ) : null}
                      <td>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => removeLine(line.variant_id)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={shop?.gst_enabled ? 7 : 6} className="text-muted text-center py-4">
                      Scan items or search a product to start a bill
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="mb-3">
            <Card.Header>Customer (optional)</Card.Header>
            <Card.Body className="d-grid gap-2">
              <Form.Control
                placeholder="Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Form.Control
                placeholder="Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>Totals</Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-between mb-2">
                <span>Subtotal</span>
                <span>{money(preview?.subtotal)}</span>
              </div>
              {preview?.gst_enabled && preview?.tax_breakup?.length > 1 ? (
                <>
                  {preview.tax_breakup.map((row) => (
                    <div key={row.rate} className="d-flex justify-content-between mb-1 small text-muted">
                      <span>
                        GST {Number(row.rate)}% on {money(row.taxable)}
                      </span>
                      <span>{money(row.tax)}</span>
                    </div>
                  ))}
                  <div className="d-flex justify-content-between mb-2">
                    <span>Total GST</span>
                    <span>{money(preview?.tax_amount)}</span>
                  </div>
                </>
              ) : (
                <div className="d-flex justify-content-between mb-2">
                  <span>
                    GST{" "}
                    {preview?.gst_enabled && preview?.tax_breakup?.length === 1
                      ? `(${Number(preview.tax_breakup[0].rate)}%)`
                      : ""}
                  </span>
                  <span>{money(preview?.tax_amount)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between mb-2">
                <span>Round off</span>
                <span>{money(preview?.round_off)}</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between fw-bold fs-5">
                <span>Total</span>
                <span>{money(preview?.total)}</span>
              </div>
              <Button
                className="w-100 mt-3"
                disabled={busy || !lines.length}
                onClick={checkout}
              >
                Complete bill
              </Button>
            </Card.Body>
          </Card>

          {lastBill ? (
            <Card className="mt-3">
              <Card.Header>Last bill</Card.Header>
              <Card.Body>
                <div className="fw-semibold">{lastBill.order_number}</div>
                <div>
                  {money(lastBill.total)} · {lastBill.payment_status}
                </div>
                <div className="text-muted small mt-1">
                  GST {money(lastBill.tax_amount)} · Round off {money(lastBill.round_off)}
                </div>
                <Button
                  className="w-100 mt-3"
                  variant="outline-primary"
                  onClick={() => openReceipt(lastBill)}
                >
                  Print / Save PDF
                </Button>
              </Card.Body>
            </Card>
          ) : null}
        </Col>
      </Row>
    </>
  );
}
