"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Form, Row } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";
import GstRateSelect, { formatRate, gstOptionsFromShop } from "../../../../components/admin/GstRateSelect";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function BarcodeStockPage() {
  const { slug } = useParams();
  const inputRef = useRef(null);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newGst, setNewGst] = useState(null);
  const [gst, setGst] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    api
      .shop(slug)
      .info()
      .then((info) => setGst(gstOptionsFromShop(info)))
      .catch(() => {});
  }, [slug]);

  function resetScanFocus() {
    setBarcode("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function lookup(code) {
    const value = (code || barcode).trim();
    if (!value) return;
    setBusy(true);
    setError("");
    setMessage("");
    setNotFound(false);
    setProduct(null);
    try {
      const found = await api.shop(slug).barcode.lookup(value, getToken("shop", slug));
      if (found) {
        setProduct(found);
        setQuantity("1");
      } else {
        setNotFound(true);
        setNewName("");
        setNewPrice("");
        setNewGst(null);
      }
      setBarcode(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onScanSubmit(e) {
    e.preventDefault();
    await lookup(barcode);
  }

  async function addStock(e) {
    e.preventDefault();
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.shop(slug).barcode.stockIn(
        { barcode: product.barcode || barcode, quantity: Number(quantity) || 1 },
        getToken("shop", slug)
      );
      setProduct(updated);
      setMessage(`Added ${quantity} to stock. New stock: ${updated.variants?.[0]?.stock ?? "—"}`);
      setNotFound(false);
      resetScanFocus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api.shop(slug).barcode.stockIn(
        {
          barcode,
          quantity: Number(quantity) || 1,
          name: newName,
          price: Number(newPrice) || 0,
          gst_rate: newGst === null || newGst === "" ? undefined : Number(newGst),
        },
        getToken("shop", slug)
      );
      setProduct(created);
      setNotFound(false);
      setMessage(
        `Created “${created.name}” with stock ${created.variants?.[0]?.stock ?? 0}. It stays hidden on the shop until you enable it in Products.`
      );
      resetScanFocus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const variant = product?.variants?.[0];

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Barcode stock</h2>
        <p className="text-muted mb-0">
          Scan a barcode to add stock. Unknown barcodes can be saved as new products (images optional).
          New products stay off the storefront until you enable them.
        </p>
      </div>

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={onScanSubmit}>
            <Form.Label>Scan or type barcode</Form.Label>
            <div className="d-flex gap-2 flex-wrap">
              <Form.Control
                ref={inputRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Barcode scanner will fill this and press Enter"
                autoComplete="off"
                style={{ maxWidth: 420, fontSize: 18 }}
              />
              <Button type="submit" disabled={busy || !barcode.trim()}>
                {busy ? "Checking…" : "Look up"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {product ? (
        <Card className="mb-4">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <span>Product found</span>
            <span className={`badge ${product.is_active ? "bg-success" : "bg-secondary"}`}>
              {product.is_active ? "On storefront" : "Hidden on storefront"}
            </span>
          </Card.Header>
          <Card.Body>
            <Row className="g-3 mb-3">
              <Col md={6}>
                <div className="text-muted small">Name</div>
                <div className="fw-semibold">{product.name}</div>
              </Col>
              <Col md={3}>
                <div className="text-muted small">Barcode</div>
                <div>{product.barcode || "—"}</div>
              </Col>
              <Col md={3}>
                <div className="text-muted small">Current stock</div>
                <div>{variant?.stock ?? 0}</div>
              </Col>
              <Col md={3}>
                <div className="text-muted small">Price</div>
                <div>{money(variant?.price)}</div>
              </Col>
              <Col md={3}>
                <div className="text-muted small">GST</div>
                <div>
                  {product.gst_rate !== null && product.gst_rate !== undefined
                    ? formatRate(product.gst_rate)
                    : `Default${gst ? ` (${formatRate(gst.defaultRate)})` : ""}`}
                </div>
              </Col>
              <Col md={3}>
                <div className="text-muted small">SKU</div>
                <div>{variant?.sku || "—"}</div>
              </Col>
            </Row>
            <Form onSubmit={addStock} className="d-flex gap-2 align-items-end flex-wrap">
              <Form.Group>
                <Form.Label>Qty to add</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{ width: 120 }}
                />
              </Form.Group>
              <Button type="submit" disabled={busy}>
                Add stock
              </Button>
            </Form>
          </Card.Body>
        </Card>
      ) : null}

      {notFound ? (
        <Card>
          <Card.Header>New product</Card.Header>
          <Card.Body>
            <p className="text-muted">
              No product with barcode <strong>{barcode}</strong>. Add it now (no photo needed). It will
              stay disabled on the shop front until you enable it under Products.
            </p>
            <Form onSubmit={createProduct}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Product name</Form.Label>
                    <Form.Control
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Product name"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Price</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="0"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Opening stock</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <GstRateSelect value={newGst} onChange={setNewGst} gst={gst} />
                </Col>
              </Row>
              <Button className="mt-3" type="submit" disabled={busy || !newName.trim()}>
                Create &amp; add stock
              </Button>
            </Form>
          </Card.Body>
        </Card>
      ) : null}
    </>
  );
}
