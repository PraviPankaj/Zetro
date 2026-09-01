"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Table } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ShopCustomersPage() {
  const { slug } = useParams();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.shop(slug).customers.list(getToken("shop", slug)).then(setRows);
  }, [slug]);

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Customers</h2>
        <p className="text-muted mb-0">Customers who have signed in or placed orders</p>
      </div>

      <Card className="admin-table-card">
        <Table responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Orders</th>
              <th>Total spent</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.name || "—"}</td>
                  <td>{row.phone}</td>
                  <td>{row.email || "—"}</td>
                  <td>{row.order_count}</td>
                  <td>{money(row.total_spent)}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-muted text-center py-4">
                  No customers yet
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
