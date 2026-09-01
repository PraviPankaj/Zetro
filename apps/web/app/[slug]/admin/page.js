"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Alert, Card, Col, Row, Table } from "react-bootstrap";
import BarChart from "../../../components/admin/BarChart";
import KpiCard from "../../../components/admin/KpiCard";
import StatusBadge from "../../../components/admin/StatusBadge";
import { api, getToken } from "../../../lib/api";
import { createShopCatalogApi } from "../../../lib/catalogApi";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ShopAdminHome() {
  const { slug } = useParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    const token = getToken("shop", slug);
    const shop = api.shop(slug);
    shop.adminMe(token).then(setMe);
    shop.subscription(token).then(setSub).catch(() => setSub(null));
    catalogApi.dashboard().then(setDashboard).catch(() => setDashboard(null));
  }, [slug, catalogApi]);

  const summary = dashboard?.summary;

  return (
    <>
      <div className="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h2 className="mb-1">{me?.shop?.name || "Dashboard"}</h2>
          <p className="text-muted mb-0">
            Storefront at /{slug} · signed in as {me?.user?.phone}
          </p>
        </div>
        <Link href={`/${slug}`} className="btn btn-outline-primary btn-sm" target="_blank">
          View storefront
        </Link>
      </div>

      {!sub ? (
        <Alert variant="warning" className="mb-4">
          No active plan. <Link href={`/${slug}/admin/plans`}>Choose a plan</Link> to add stock.
        </Alert>
      ) : (
        <Alert variant="success" className="mb-4">
          {sub.plan?.name} · {sub.status} until {new Date(sub.ends_at).toLocaleDateString()}
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <KpiCard label="Total Revenue" value={money(summary?.total_revenue)} variant="success" icon="₹" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard label="Total Orders" value={summary?.total_orders ?? "—"} variant="info" icon="📦" />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard
            label="Products"
            value={summary ? `${summary.active_products}/${summary.products_count}` : "—"}
            sub={`${summary?.total_stock_units ?? 0} stock units`}
            variant="default"
            icon="🏷"
          />
        </Col>
        <Col sm={6} lg={3}>
          <KpiCard
            label="Low Stock"
            value={summary?.low_stock_count ?? "—"}
            sub="items ≤ 5 units"
            variant={summary?.low_stock_count > 0 ? "warning" : "default"}
            icon="⚠"
          />
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card className="h-100 admin-table-card">
            <Card.Header>Orders by status</Card.Header>
            <Card.Body>
              <BarChart data={dashboard?.orders_by_status} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100 admin-table-card">
            <Card.Header>Payment status</Card.Header>
            <Card.Body>
              <BarChart data={dashboard?.payment_by_status} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={7}>
          <Card className="admin-table-card">
            <Card.Header className="d-flex justify-content-between align-items-center">
              Recent orders
              <Link href={`/${slug}/admin/orders`} className="btn btn-sm btn-outline-primary">
                View all
              </Link>
            </Card.Header>
            <Table responsive className="mb-0 text-nowrap align-middle">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.recent_orders?.length ? (
                  dashboard.recent_orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td>{o.customer_name || o.customer_phone || "—"}</td>
                      <td>{money(o.total)}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-muted text-center py-4">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="admin-table-card">
            <Card.Header>Low stock alerts</Card.Header>
            <Table responsive className="mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.low_stock?.length ? (
                  dashboard.low_stock.map((row) => (
                    <tr key={`${row.product_id}-${row.sku}`}>
                      <td>{row.product_name}</td>
                      <td className="text-danger fw-semibold">{row.stock}</td>
                      <td>{money(row.price)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-muted text-center py-4">
                      All good — no low stock
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
