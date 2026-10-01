"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { api, getToken } from "../../../lib/api";

export default function PlatformShopsPage() {
  const [shops, setShops] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", owner_phone: "", description: "" });

  function load() {
    api.platform.shops.list(getToken("platform")).then(setShops);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.platform.shops.create(form, getToken("platform"));
      setForm({ name: "", slug: "", owner_phone: "", description: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2 className="mb-4">Shops</h2>
      <Row>
        <Col lg={8}>
          <Card className="mb-4">
            <Table responsive className="text-nowrap mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Storefront</th>
                  <th>GST</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <small className="text-muted d-block text-capitalize">{s.shop_mode || "both"}</small>
                    </td>
                    <td>
                      <a href={`/${s.slug}`}>/{s.slug}</a>
                    </td>
                    <td className="small">
                      {s.gst_enabled ? (
                        <>
                          On
                          <span className="text-muted d-block">
                            {(Array.isArray(s.gst_rates) && s.gst_rates.length
                              ? s.gst_rates
                              : [s.gst_rate]
                            )
                              .map((r) => `${Number(r)}%`)
                              .join(", ")}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">Off</span>
                      )}
                    </td>
                    <td>{s.owner_phone}</td>
                    <td>{s.status}</td>
                    <td className="small">
                      <div className="d-flex flex-column gap-1">
                        <Link href={`/platform/shops/${s.id}/stock`}>Stock &amp; catalog</Link>
                        <Link href={`/platform/shops/${s.id}/barcodes`}>Barcode labels</Link>
                        <Link href={`/platform/shops/${s.id}/settings`}>GST &amp; settings</Link>
                        <Link href={`/platform/shops/${s.id}/reports`}>Reports</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={4}>
          <Card>
            <Card.Body>
              <h4>Add shop</h4>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <Form onSubmit={onSubmit}>
                <Form.Group className="mb-2">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Slug</Form.Label>
                  <Form.Control
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                    placeholder="abc"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Owner mobile</Form.Label>
                  <Form.Control
                    value={form.owner_phone}
                    onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                    placeholder="9999999999"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Form.Group>
                <Button type="submit">Create shop</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
