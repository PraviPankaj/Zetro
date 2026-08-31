"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Form, Table } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";

const STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export default function ShopOrdersPage() {
  const { slug } = useParams();
  const [orders, setOrders] = useState([]);

  function load() {
    api.shop(slug).orders.list(getToken("shop", slug)).then(setOrders);
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function changeStatus(id, status) {
    await api.shop(slug).orders.setStatus(id, status, getToken("shop", slug));
    load();
  }

  return (
    <>
      <h2 className="mb-4">Orders</h2>
      <Card>
        <Table responsive className="text-nowrap mb-0">
          <thead>
            <tr>
              <th>Number</th>
              <th>Total</th>
              <th>Pay</th>
              <th>Status</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>₹{o.total}</td>
                <td>
                  {o.payment_provider} / {o.payment_status}
                </td>
                <td>{o.status}</td>
                <td>
                  <Form.Select
                    size="sm"
                    value={o.status}
                    onChange={(e) => changeStatus(o.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Form.Select>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
