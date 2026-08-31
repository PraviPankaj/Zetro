"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Table } from "react-bootstrap";
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

  return (
    <>
      <h2 className="mb-1">Shop reports</h2>
      <p className="text-muted mb-4">Sales and stock summary across all shops.</p>
      <Card>
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
                <td>{row.low_stock_count}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Link href={`/platform/shops/${row.shop_id}/reports`} className="btn btn-sm btn-outline-primary">
                      Report
                    </Link>
                    <Link href={`/platform/shops/${row.shop_id}/stock`} className="btn btn-sm btn-outline-secondary">
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
