"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Col, Row, Table } from "react-bootstrap";
import BarChart from "../../../components/admin/BarChart";
import KpiCard from "../../../components/admin/KpiCard";
import { api, getToken } from "../../../lib/api";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function PlatformReportsPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.platform.reports(getToken("platform")).then(setRows);
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          orders: acc.orders + r.total_orders,
          revenue: acc.revenue + r.total_revenue,
          paid: acc.paid + r.paid_revenue,
          products: acc.products + r.products_count,
          lowStock: acc.lowStock + r.low_stock_count,
        }),
        { orders: 0, revenue: 0, paid: 0, products: 0, lowStock: 0 }
      ),
    [rows]
  );

  const revenueByShop = useMemo(() => {
    const data = {};
    for (const r of rows) {
      if (r.total_revenue > 0) data[r.shop_name] = r.total_revenue;
    }
    return data;
  }, [rows]);

  const ordersByShop = useMemo(() => {
    const data = {};
    for (const r of rows) {
      if (r.total_orders > 0) data[r.shop_name] = r.total_orders;
    }
    return data;
  }, [rows]);

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Reports</h2>
        <p className="text-muted mb-0">Sales and stock summary across all shops</p>
      </div>

      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <KpiCard label="Total Orders" value={totals.orders} variant="info" icon="📦" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Total Revenue" value={money(totals.revenue)} variant="success" icon="₹" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Paid Revenue" value={money(totals.paid)} variant="success" icon="✓" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard
            label="Low Stock Items"
            value={totals.lowStock}
            variant={totals.lowStock > 0 ? "warning" : "default"}
            icon="⚠"
          />
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card className="h-100 admin-table-card">
            <Card.Header>Revenue by shop</Card.Header>
            <Card.Body>
              <BarChart data={revenueByShop} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100 admin-table-card">
            <Card.Header>Orders by shop</Card.Header>
            <Card.Body>
              <BarChart data={ordersByShop} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="admin-table-card">
        <Card.Header>All shops</Card.Header>
        <Table responsive className="mb-0 text-nowrap align-middle">
          <thead>
            <tr>
              <th>Shop</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>Paid</th>
              <th>Products</th>
              <th>Stock units</th>
              <th>Low stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.shop_id}>
                <td>
                  <div className="fw-semibold">{row.shop_name}</div>
                  <small className="text-muted">/{row.shop_slug}</small>
                </td>
                <td>{row.total_orders}</td>
                <td>{money(row.total_revenue)}</td>
                <td>{money(row.paid_revenue)}</td>
                <td>
                  {row.active_products}/{row.products_count}
                </td>
                <td>{row.total_stock_units}</td>
                <td className={row.low_stock_count > 0 ? "text-danger fw-semibold" : ""}>
                  {row.low_stock_count}
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Link
                      href={`/platform/shops/${row.shop_id}/reports`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      Report
                    </Link>
                    <Link
                      href={`/platform/shops/${row.shop_id}/stock`}
                      className="btn btn-sm btn-outline-secondary"
                    >
                      Stock
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
