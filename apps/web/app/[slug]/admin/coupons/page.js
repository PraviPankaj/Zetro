"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Form, Modal, Table } from "react-bootstrap";
import StatusBadge from "../../../../components/admin/StatusBadge";
import { api, getToken } from "../../../../lib/api";

const emptyForm = {
  code: "",
  title: "",
  discount_type: "percent",
  discount_value: "",
  min_order_amount: "0",
  max_uses: "",
  is_active: true,
};

function money(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ShopCouponsPage() {
  const { slug } = useParams();
  const [rows, setRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.shop(slug).coupons.list(getToken("shop", slug)).then(setRows);
  }

  useEffect(() => {
    load();
  }, [slug]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
    setError("");
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      code: row.code,
      title: row.title,
      discount_type: row.discount_type,
      discount_value: String(row.discount_value),
      min_order_amount: String(row.min_order_amount),
      max_uses: row.max_uses != null ? String(row.max_uses) : "",
      is_active: row.is_active,
    });
    setShowModal(true);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        code: form.code,
        title: form.title,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount || 0),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        is_active: form.is_active,
      };
      const token = getToken("shop", slug);
      if (editing) {
        const { code, ...update } = payload;
        await api.shop(slug).coupons.update(editing.id, update, token);
        setMessage("Coupon updated");
      } else {
        await api.shop(slug).coupons.create(payload, token);
        setMessage("Coupon created");
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row) {
    if (!window.confirm(`Delete coupon ${row.code}?`)) return;
    await api.shop(slug).coupons.delete(row.id, getToken("shop", slug));
    setMessage("Coupon deleted");
    load();
  }

  return (
    <>
      <div className="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h2 className="mb-1">Coupons</h2>
          <p className="text-muted mb-0">Create discount codes for your customers</p>
        </div>
        <Button onClick={openCreate}>Create coupon</Button>
      </div>

      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card className="admin-table-card">
        <Table responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Discount</th>
              <th>Min order</th>
              <th>Uses</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.code}</td>
                  <td>{row.title}</td>
                  <td>
                    {row.discount_type === "percent"
                      ? `${row.discount_value}%`
                      : money(row.discount_value)}
                  </td>
                  <td>{money(row.min_order_amount)}</td>
                  <td>
                    {row.used_count}
                    {row.max_uses != null ? ` / ${row.max_uses}` : ""}
                  </td>
                  <td>
                    <StatusBadge status={row.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="text-nowrap">
                    <Button size="sm" variant="outline-primary" className="me-2" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => onDelete(row)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-muted text-center py-4">
                  No coupons yet
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Form onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? "Edit coupon" : "Create coupon"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <Form.Group className="mb-3">
              <Form.Label>Code</Form.Label>
              <Form.Control
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={!!editing}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Form.Group>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed amount</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Value</Form.Label>
                  <Form.Control
                    type="number"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    required
                  />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-3 mt-3">
              <Form.Label>Minimum order amount</Form.Label>
              <Form.Control
                type="number"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Max uses (optional)</Form.Label>
              <Form.Control
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </Form.Group>
            <Form.Check
              type="switch"
              label="Active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
