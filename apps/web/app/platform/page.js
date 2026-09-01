"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Col, Row, Table } from "react-bootstrap";
import KpiCard from "../../components/admin/KpiCard";
import { api, getToken } from "../../lib/api";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function PlatformHome() {
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const token = getToken("platform");
    api.platform.me(token).then(setMe);
    api.platform.shops.list(token).then(setShops);
    api.platform.users.list(token).then(setUsers);
    api.platform.reports(token).then(setReports).catch(() => setReports([]));
  }, []);

  const totals = reports.reduce(
    (acc, r) => ({
      orders: acc.orders + r.total_orders,
      revenue: acc.revenue + r.total_revenue,
      paid: acc.paid + r.paid_revenue,
      lowStock: acc.lowStock + r.low_stock_count,
    }),
    { orders: 0, revenue: 0, paid: 0, lowStock: 0 }
  );

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Platform Overview</h2>
        <p className="text-muted">Welcome {me?.username}. Manage shops and platform staff.</p>
      </div>

      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <KpiCard label="Shops" value={shops.length} icon="🏪" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Platform Users" value={users.length} icon="👤" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Total Orders" value={totals.orders} variant="info" icon="📦" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Total Revenue" value={money(totals.revenue)} variant="success" icon="₹" />
        </Col>
      </Row>

      <Card className="admin-table-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          Shops
          <Link href="/platform/shops" className="btn btn-sm btn-outline-primary">
            Manage shops
          </Link>
        </Card.Header>
        <Table responsive className="mb-0 text-nowrap align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>Products</th>
              <th>Low stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shops.slice(0, 10).map((s) => {
              const report = reports.find((r) => r.shop_id === s.id);
              return (
                <tr key={s.id}>
                  <td className="fw-semibold">{s.name}</td>
                  <td>
                    <Link href={`/${s.slug}`} target="_blank">
                      {s.slug}
                    </Link>
                  </td>
                  <td>{report?.total_orders ?? "—"}</td>
                  <td>{report ? money(report.total_revenue) : "—"}</td>
                  <td>
                    {report ? `${report.active_products}/${report.products_count}` : "—"}
                  </td>
                  <td className={report?.low_stock_count > 0 ? "text-danger fw-semibold" : ""}>
                    {report?.low_stock_count ?? "—"}
                  </td>
                  <td className="text-capitalize">{s.status}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <Link href={`/platform/shops/${s.id}/reports`} className="btn btn-sm btn-outline-primary">
                        Report
                      </Link>
                      <Link href={`/platform/shops/${s.id}/stock`} className="btn btn-sm btn-outline-secondary">
                        Stock
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
