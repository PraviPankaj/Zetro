"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";
import { printBillReceipt } from "../../../../lib/printBillReceipt";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function BillingPage() {
  const { slug } = useParams();
  const inputRef = useRef(null);
  const [shop, setShop] = useState(null);
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState(null);
  const [lastBill, setLastBill] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.shop(slug).info().then(setShop);
    inputRef.current?.focus();
  }, [slug]);

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

  async function addByBarcode(e) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const product = await api.shop(slug).barcode.lookup(code, getToken("shop", slug));
      if (!product) {
        setError(`No product for barcode ${code}. Add it under Barcode stock first.`);
        return;
      }
      const variant = product.variants?.[0];
      if (!variant) {
        setError("Product has no sellable variant");
        return;
      }
      setLines((prev) => {
        const existing = prev.find((l) => l.variant_id === variant.id);
        if (existing) {
          return prev.map((l) =>
            l.variant_id === variant.id ? { ...l, quantity: l.quantity + 1 } : l
          );
        }
        return [
          ...prev,
          {
            variant_id: variant.id,
            product_name: product.name,
            barcode: product.barcode,
            unit_price: Number(variant.price),
            quantity: 1,
            stock: Number(variant.stock),
          },
        ];
      });
      setBarcode("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
      // Print after a short delay so React can paint; iframe print needs no pop-up
      setTimeout(() => openReceipt(bill, customerSnapshot), 100);
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const gstLabel = shop?.gst_enabled
    ? `GST on (${Number(shop.gst_rate || 0)}%)`
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
              <Form onSubmit={addByBarcode}>
                <Form.Label>Scan product barcode</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  <Form.Control
                    ref={inputRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan barcode and press Enter"
                    autoComplete="off"
                    style={{ maxWidth: 420, fontSize: 18 }}
                  />
                  <Button type="submit" disabled={busy || !barcode.trim()}>
                    Add
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          <Card className="admin-table-card">
            <Table responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Barcode</th>
                  <th>Price</th>
                  <th style={{ width: 110 }}>Qty</th>
                  <th>Line</th>
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
                      <td>{line.barcode || "—"}</td>
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
                    <td colSpan={6} className="text-muted text-center py-4">
                      Scan items to start a bill
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
              <div className="d-flex justify-content-between mb-2">
                <span>GST {preview?.gst_enabled ? `(${preview.gst_rate}%)` : ""}</span>
                <span>{money(preview?.tax_amount)}</span>
              </div>
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
