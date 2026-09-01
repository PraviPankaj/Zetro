"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Form, Table } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";

const LOW_STOCK = 5;

function money(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ShopInventoryPage() {
  const { slug } = useParams();
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.shop(slug).inventory.list(getToken("shop", slug)).then(setRows);
  }

  useEffect(() => {
    load();
  }, [slug]);

  const filtered = useMemo(() => {
    if (filter === "low") return rows.filter((r) => r.stock <= LOW_STOCK);
    if (filter === "out") return rows.filter((r) => r.stock <= 0);
    return rows;
  }, [rows, filter]);

  function stockValue(row) {
    return edits[row.variant_id] ?? row.stock;
  }

  async function saveAll() {
    const updates = Object.entries(edits).map(([variant_id, stock]) => ({
      variant_id: Number(variant_id),
      stock: Number(stock),
    }));
    if (!updates.length) return;
    setSaving(true);
    setMessage("");
    try {
      await api.shop(slug).inventory.bulkUpdate(updates, getToken("shop", slug));
      setEdits({});
      setMessage(`Updated ${updates.length} items`);
      load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h2 className="mb-1">Inventory</h2>
          <p className="text-muted mb-0">Track and update stock levels</p>
        </div>
        <Button onClick={saveAll} disabled={saving || !Object.keys(edits).length}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {message ? (
        <Alert variant={message.includes("Updated") ? "success" : "danger"}>{message}</Alert>
      ) : null}

      <Card className="admin-table-card">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <span>{filtered.length} items</span>
            <Form.Select
              size="sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="all">All stock</option>
              <option value="low">Low stock (≤5)</option>
              <option value="out">Out of stock</option>
            </Form.Select>
          </div>
        </Card.Header>
        <Table responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((row) => (
                <tr key={row.variant_id}>
                  <td className="fw-semibold">{row.product_name}</td>
                  <td>{row.sku}</td>
                  <td>{money(row.price)}</td>
                  <td style={{ width: 120 }}>
                    <Form.Control
                      size="sm"
                      type="number"
                      value={stockValue(row)}
                      className={row.stock <= LOW_STOCK ? "border-danger" : ""}
                      onChange={(e) =>
                        setEdits({ ...edits, [row.variant_id]: e.target.value })
                      }
                    />
                  </td>
                  <td className={row.stock <= LOW_STOCK ? "text-danger fw-semibold" : ""}>
                    {row.stock <= 0 ? "Out of stock" : row.stock <= LOW_STOCK ? "Low" : "OK"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-muted text-center py-4">
                  No inventory items
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
