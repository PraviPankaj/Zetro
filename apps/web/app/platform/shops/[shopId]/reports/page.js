"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Col, Row, Table } from "react-bootstrap";
import BarChart from "../../../../../components/admin/BarChart";
import KpiCard from "../../../../../components/admin/KpiCard";
import StatusBadge from "../../../../../components/admin/StatusBadge";
import { api, getToken } from "../../../../../lib/api";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function PlatformShopReportsPage() {
  const { shopId } = useParams();
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.platform.shops.reports(Number(shopId), getToken("platform")).then(setReport);
  }, [shopId]);

  if (!report) return <div>Loading report…</div>;

  const { shop, summary, orders_by_status, payment_by_status, top_products, low_stock, recent_orders } =
    report;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1">{shop.name} — Reports</h2>
          <p className="text-muted mb-0">Sales and inventory snapshot</p>
        </div>
        <div className="d-flex gap-2">
          <Link href={`/platform/shops/${shopId}/stock`} className="btn btn-outline-primary">
            Manage stock
          </Link>
          <Link href="/platform/reports" className="btn btn-outline-secondary">
            All shops
          </Link>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <KpiCard label="Total orders" value={summary.total_orders} variant="info" icon="📦" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Total revenue" value={money(summary.total_revenue)} variant="success" icon="₹" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Paid revenue" value={money(summary.paid_revenue)} variant="success" icon="✓" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard
            label="Stock units"
            value={summary.total_stock_units}
            sub={`${summary.low_stock_count} low stock`}
            variant={summary.low_stock_count > 0 ? "warning" : "default"}
            icon="📊"
          />
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card className="h-100 admin-table-card">
            <Card.Header>Orders by status</Card.Header>
            <Card.Body>
              <BarChart data={orders_by_status} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100 admin-table-card">
            <Card.Header>Payments</Card.Header>
            <Card.Body>
              <BarChart data={payment_by_status} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="admin-table-card">
            <Card.Header>Top selling products</Card.Header>
            <Table responsive className="mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {top_products.length ? (
                  top_products.map((row) => (
                    <tr key={row.product_name}>
                      <td>{row.product_name}</td>
                      <td>{row.quantity}</td>
                      <td>{money(row.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-muted">
                      No sales yet
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="admin-table-card">
            <Card.Header>Low stock (≤ 5 units)</Card.Header>
            <Table responsive className="mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {low_stock.length ? (
                  low_stock.map((row) => (
                    <tr key={`${row.product_id}-${row.sku}`}>
                      <td>{row.product_name}</td>
                      <td>{row.sku}</td>
                      <td className="text-danger fw-semibold">{row.stock}</td>
                      <td>{money(row.price)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-muted">
                      All good — no low stock items
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={12}>
          <Card className="admin-table-card">
            <Card.Header>Recent orders</Card.Header>
            <Table responsive className="mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent_orders.length ? (
                  recent_orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>
                        <StatusBadge status={o.payment_status} />
                      </td>
                      <td>{o.items_count}</td>
                      <td>{money(o.total)}</td>
                      <td>{o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-muted">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>
    </>
  );
}
