"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Form, Modal, Table } from "react-bootstrap";
import StatusBadge from "../../../../components/admin/StatusBadge";
import { createShopCatalogApi } from "../../../../lib/catalogApi";

export default function ShopCategoriesPage() {
  const { slug } = useParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", slug: "", parent_id: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    catalogApi.listCategories().then(setCategories);
  }

  useEffect(() => {
    load();
  }, [catalogApi]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", slug: "", parent_id: "" });
    setShowModal(true);
    setError("");
  }

  function openEdit(cat) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      parent_id: cat.parent_id ? String(cat.parent_id) : "",
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
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
        parent_id: form.parent_id ? Number(form.parent_id) : null,
      };
      if (editing) {
        await catalogApi.updateCategory(editing.id, payload);
        setMessage("Category updated");
      } else {
        await catalogApi.createCategory(payload);
        setMessage("Category created");
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(cat) {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    setError("");
    try {
      await catalogApi.deleteCategory(cat.id);
      setMessage("Category deleted");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(cat) {
    try {
      await catalogApi.updateCategory(cat.id, { is_active: !cat.is_active });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const parentOptions = categories.filter((c) => !editing || c.id !== editing.id);

  return (
    <>
      <div className="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h2 className="mb-1">Categories</h2>
          <p className="text-muted mb-0">Organize products into categories</p>
        </div>
        <Button onClick={openCreate}>Create category</Button>
      </div>

      {message ? (
        <Alert variant="success" onClose={() => setMessage("")} dismissible>
          {message}
        </Alert>
      ) : null}
      {error && !showModal ? (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      ) : null}

      <Card className="admin-table-card">
        <Table responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Parent</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length ? (
              categories.map((cat) => {
                const parent = categories.find((c) => c.id === cat.parent_id);
                return (
                  <tr key={cat.id}>
                    <td className="fw-semibold">{cat.parent_id ? `↳ ${cat.name}` : cat.name}</td>
                    <td className="text-muted">{cat.slug}</td>
                    <td>{parent?.name || "—"}</td>
                    <td>
                      <StatusBadge status={cat.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="text-nowrap">
                      <Button size="sm" variant="outline-primary" className="me-2" onClick={() => openEdit(cat)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-2"
                        onClick={() => toggleActive(cat)}
                      >
                        {cat.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => onDelete(cat)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="text-muted text-center py-4">
                  No categories yet. Click <strong>Create category</strong> to add one.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Form onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? "Edit category" : "Create category"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Slug</Form.Label>
              <Form.Control
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-generated from name"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Parent category</Form.Label>
              <Form.Select
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              >
                <option value="">None (top level)</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
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
