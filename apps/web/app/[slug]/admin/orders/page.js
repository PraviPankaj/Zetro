"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Col, Form, Row, Table } from "react-bootstrap";
import KpiCard from "../../../../components/admin/KpiCard";
import OrderDetailModal from "../../../../components/admin/OrderDetailModal";
import StatusBadge from "../../../../components/admin/StatusBadge";
import { api, getToken } from "../../../../lib/api";

const STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"];

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ShopOrdersPage() {
  const { slug } = useParams();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  function load() {
    api.shop(slug).orders.list(getToken("shop", slug)).then(setOrders);
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function changeStatus(id, status) {
    await api.shop(slug).orders.setStatus(id, status, getToken("shop", slug));
    load();
    if (selected?.id === id) {
      setSelected((prev) => (prev ? { ...prev, status } : null));
    }
  }

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
    return counts;
  }, [orders]);

  const filtered = orders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    const addr = o.shipping_address || {};
    return (
      o.order_number?.toLowerCase().includes(needle) ||
      addr.name?.toLowerCase().includes(needle) ||
      addr.phone?.includes(needle)
    );
  });

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Orders</h2>
        <p className="text-muted mb-0">Manage and track customer orders</p>
      </div>

      <Row className="g-3 mb-4">
        <Col sm={6} md={4} lg={2}>
          <KpiCard label="Total" value={orders.length} />
        </Col>
        {STATUSES.map((s) => (
          <Col sm={6} md={4} lg={2} key={s}>
            <KpiCard
              label={s}
              value={statusCounts[s] || 0}
              variant={s === "delivered" ? "success" : s === "cancelled" ? "danger" : "default"}
            />
          </Col>
        ))}
      </Row>

      <Card className="admin-table-card">
        <Card.Header>
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <span>All orders ({filtered.length})</span>
            <div className="d-flex gap-2">
              <Form.Control
                size="sm"
                placeholder="Search order, customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 200 }}
              />
              <Form.Select
                size="sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 140 }}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
        </Card.Header>
        <Table responsive className="mb-0 text-nowrap align-middle">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((o) => {
                const addr = o.shipping_address || {};
                return (
                  <tr key={o.id}>
                    <td className="fw-semibold">{o.order_number}</td>
                    <td>
                      <div>{addr.name || "—"}</div>
                      <small className="text-muted">{addr.phone}</small>
                    </td>
                    <td>{o.items?.length || 0}</td>
                    <td>{money(o.total)}</td>
                    <td>
                      <StatusBadge status={o.payment_status} />
                      <small className="text-muted d-block text-capitalize">{o.payment_provider}</small>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setSelected(o)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="text-muted text-center py-4">
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <OrderDetailModal
        order={selected}
        show={!!selected}
        onHide={() => setSelected(null)}
        statuses={STATUSES}
        onStatusChange={changeStatus}
      />
    </>
  );
}
