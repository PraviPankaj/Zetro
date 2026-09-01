"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Modal, Row, Table } from "react-bootstrap";
import ThemePicker from "./ThemePicker";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  price: "",
  stock: "10",
  sku: "",
  categoryIds: [],
};

function CategoryPicker({ categories, value, onChange, idPrefix = "cat" }) {
  if (!categories.length) {
    return <p className="text-muted small mb-0">No categories yet. Create one below.</p>;
  }
  return (
    <div className="d-flex flex-wrap gap-2">
      {categories.map((cat) => {
        const checked = value.includes(cat.id);
        return (
          <Form.Check
            key={cat.id}
            type="checkbox"
            id={`${idPrefix}-${cat.id}`}
            label={cat.parent_id ? `↳ ${cat.name}` : cat.name}
            checked={checked}
            onChange={(e) => {
              if (e.target.checked) onChange([...value, cat.id]);
              else onChange(value.filter((cid) => cid !== cat.id));
            }}
          />
        );
      })}
    </div>
  );
}

export default function StockManager({
  catalogApi,
  title = "Stock",
  subtitle,
  headerActions,
  showThemePicker = false,
  currentTheme,
  onThemeChange,
}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [catForm, setCatForm] = useState({ name: "", slug: "", parent_id: "" });
  const [files, setFiles] = useState({});
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editFile, setEditFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  function load() {
    catalogApi.listProducts().then(setProducts);
    catalogApi.listCategories().then(setCategories);
  }

  useEffect(() => {
    load();
  }, [catalogApi]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const product = await catalogApi.createProduct({
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
        description: form.description,
        category_ids: form.categoryIds,
        variants: [
          {
            sku: form.sku || `${form.slug || "sku"}-1`,
            name: "Default",
            price: Number(form.price),
            stock: Number(form.stock),
          },
        ],
      });
      if (files.new) {
        await catalogApi.uploadImage(product.id, files.new);
      }
      setForm(emptyForm);
      setFiles({});
      setMessage("Product added");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEdit(product) {
    const variant = product.variants?.[0];
    setEditing(product);
    setEditForm({
      name: product.name || "",
      slug: product.slug || "",
      description: product.description || "",
      price: variant?.price ?? "",
      stock: variant?.stock ?? 0,
      sku: variant?.sku || "",
      is_active: product.is_active,
      variantId: variant?.id,
      categoryIds: (product.categories || []).map((c) => c.id),
    });
    setEditFile(null);
    setError("");
    setMessage("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await catalogApi.updateProduct(editing.id, {
        name: editForm.name,
        slug: editForm.slug,
        description: editForm.description,
        is_active: editForm.is_active,
        category_ids: editForm.categoryIds,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        variants: [
          {
            id: editForm.variantId,
            sku: editForm.sku,
            price: Number(editForm.price),
            stock: Number(editForm.stock),
          },
        ],
      });
      if (editFile) {
        await catalogApi.uploadImage(editing.id, editFile);
      }
      setEditing(null);
      setMessage("Product updated");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onExtraImage(productId, file) {
    if (!file) return;
    try {
      await catalogApi.uploadImage(productId, file);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDeleteImage(productId, imageId) {
    if (!window.confirm("Remove this image?")) return;
    setError("");
    try {
      const updated = await catalogApi.deleteImage(productId, imageId);
      if (editing?.id === productId) {
        setEditing(updated);
      }
      setMessage("Image removed");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDelete(product) {
    if (
      !window.confirm(
        `Delete "${product.name}"? This cannot be undone. Products with order history must be deactivated instead.`
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await catalogApi.deleteProduct(product.id);
      setMessage(`Deleted ${product.name}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCategory(e) {
    e.preventDefault();
    setError("");
    try {
      await catalogApi.createCategory({
        name: catForm.name,
        slug: catForm.slug || catForm.name.toLowerCase().replace(/\s+/g, "-"),
        parent_id: catForm.parent_id ? Number(catForm.parent_id) : null,
      });
      setCatForm({ name: "", slug: "", parent_id: "" });
      setMessage("Category created");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1">{title}</h2>
          {subtitle ? <p className="text-muted mb-0">{subtitle}</p> : null}
        </div>
        {headerActions}
      </div>

      {showThemePicker ? (
        <Card className="mb-4">
          <Card.Body>
            <h5 className="mb-3">Storefront theme</h5>
            <ThemePicker
              value={currentTheme || "playful"}
              saving={themeSaving}
              onChange={async (themeId) => {
                setThemeSaving(true);
                setError("");
                try {
                  await catalogApi.updateSettings({ storefront_theme: themeId });
                  onThemeChange?.(themeId);
                  setMessage("Theme updated");
                } catch (err) {
                  setError(err.message || "Could not update theme");
                } finally {
                  setThemeSaving(false);
                }
              }}
            />
          </Card.Body>
        </Card>
      ) : null}

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error && !editing ? <Alert variant="danger">{error}</Alert> : null}
      <Row>
        <Col lg={8}>
          <Card>
            <Table responsive className="text-nowrap mb-0 align-middle">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Categories</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Images</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {p.images?.[0]?.url ? (
                          <img
                            src={p.images[0].url}
                            alt=""
                            width={40}
                            height={40}
                            style={{ objectFit: "cover", borderRadius: 4 }}
                          />
                        ) : null}
                        <div>
                          <div className="fw-semibold">{p.name}</div>
                          <small className="text-muted">{p.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <small className="text-muted">
                        {(p.categories || []).map((c) => c.name).join(", ") || "—"}
                      </small>
                    </td>
                    <td>{p.variants?.[0] ? `₹${p.variants[0].price}` : "—"}</td>
                    <td>{p.variants?.[0]?.stock}</td>
                    <td>{p.images?.length || 0}</td>
                    <td>
                      <div className="d-flex gap-2 align-items-center flex-wrap">
                        <Button size="sm" variant="outline-primary" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => onDelete(p)}>
                          Delete
                        </Button>
                        <Form.Control
                          type="file"
                          size="sm"
                          style={{ maxWidth: 160 }}
                          onChange={(e) => onExtraImage(p.id, e.target.files?.[0])}
                        />
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
              <h4>Add product</h4>
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
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="blue-shirt"
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Price</Form.Label>
                  <Form.Control
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Stock</Form.Label>
                  <Form.Control
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Categories</Form.Label>
                  <CategoryPicker
                    categories={categories}
                    value={form.categoryIds}
                    onChange={(categoryIds) => setForm({ ...form, categoryIds })}
                    idPrefix="new-cat"
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Images</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFiles({ new: e.target.files?.[0] })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Form.Group>
                <Button type="submit">Save product</Button>
              </Form>
            </Card.Body>
          </Card>
          <Card className="mt-3">
            <Card.Body>
              <h4>Categories</h4>
              <p className="text-muted small">
                Products can belong to multiple categories (e.g. Kids Pants and Kids Clothing).
              </p>
              <Form onSubmit={createCategory}>
                <Form.Group className="mb-2">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Slug</Form.Label>
                  <Form.Control
                    value={catForm.slug}
                    onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                    placeholder="kids-pants"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Parent category</Form.Label>
                  <Form.Select
                    value={catForm.parent_id}
                    onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value })}
                  >
                    <option value="">None (top level)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Button type="submit" variant="outline-primary">
                  Add category
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={!!editing} onHide={() => setEditing(null)} centered size="lg">
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit product</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && editing ? <Alert variant="danger">{error}</Alert> : null}
            <Form.Group className="mb-2">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Slug</Form.Label>
              <Form.Control
                value={editForm.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
              />
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-2">
                  <Form.Label>Price</Form.Label>
                  <Form.Control
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-2">
                  <Form.Label>Stock</Form.Label>
                  <Form.Control
                    type="number"
                    value={editForm.stock}
                    onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-2">
              <Form.Label>SKU</Form.Label>
              <Form.Control
                value={editForm.sku}
                onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Categories</Form.Label>
              <CategoryPicker
                categories={categories}
                value={editForm.categoryIds}
                onChange={(categoryIds) => setEditForm({ ...editForm, categoryIds })}
                idPrefix="edit-cat"
              />
            </Form.Group>
            <Form.Check
              type="switch"
              className="mb-2"
              label="Active on storefront"
              checked={!!editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
            />
            <Form.Group>
              <Form.Label>Add image</Form.Label>
              <Form.Control type="file" accept="image/*" onChange={(e) => setEditFile(e.target.files?.[0])} />
            </Form.Group>
            {editing?.images?.length ? (
              <div className="mt-3">
                <Form.Label className="mb-2">Images</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  {editing.images.map((im) => (
                    <div key={im.id} className="position-relative">
                      <img
                        src={im.url}
                        alt=""
                        width={72}
                        height={72}
                        style={{ objectFit: "cover", borderRadius: 6 }}
                      />
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="position-absolute top-0 end-0 translate-middle rounded-circle p-0"
                        style={{ width: 22, height: 22, fontSize: 14, lineHeight: 1 }}
                        title="Remove image"
                        onClick={() => onDeleteImage(editing.id, im.id)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
