"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Col, Row, Table } from "react-bootstrap";
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
      <div className="d-flex justify-content-between align-items-center mb-4">
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

      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card>
            <Card.Body>
              <div className="text-muted">Total orders</div>
              <h3>{summary.total_orders}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <Card.Body>
              <div className="text-muted">Total revenue</div>
              <h3>{money(summary.total_revenue)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <Card.Body>
              <div className="text-muted">Paid revenue</div>
              <h3>{money(summary.paid_revenue)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <Card.Body>
              <div className="text-muted">Stock units</div>
              <h3>{summary.total_stock_units}</h3>
              <small className="text-danger">{summary.low_stock_count} low stock</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Orders by status</Card.Header>
            <Table responsive className="mb-0">
              <tbody>
                {Object.entries(orders_by_status).map(([status, count]) => (
                  <tr key={status}>
                    <td className="text-capitalize">{status}</td>
                    <td className="text-end">{count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Payments</Card.Header>
            <Table responsive className="mb-0">
              <tbody>
                {Object.entries(payment_by_status).map(([status, count]) => (
                  <tr key={status}>
                    <td className="text-capitalize">{status}</td>
                    <td className="text-end">{count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card>
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
          <Card>
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
                      <td>{row.stock}</td>
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
          <Card>
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
                      <td className="text-capitalize">{o.status}</td>
                      <td className="text-capitalize">{o.payment_status}</td>
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
