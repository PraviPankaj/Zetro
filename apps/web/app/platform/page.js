"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Col, Row, Table } from "react-bootstrap";
import { api, getToken } from "../../lib/api";

export default function PlatformHome() {
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const token = getToken("platform");
    api.platform.me(token).then(setMe);
    api.platform.shops.list(token).then(setShops);
    api.platform.users.list(token).then(setUsers);
  }, []);

  return (
    <>
      <h2 className="mb-1">Overview</h2>
      <p className="text-muted">Welcome {me?.username}. Manage shops and platform staff.</p>
      <Row className="mb-4">
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="text-muted">Shops</div>
              <h2>{shops.length}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="text-muted">Users</div>
              <h2>{users.length}</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Card>
        <Card.Header className="d-flex justify-content-between">
          Recent shops
          <Link href="/platform/shops">View all</Link>
        </Card.Header>
        <Table responsive className="mb-0 text-nowrap">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Owner phone</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shops.slice(0, 8).map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <Link href={`/${s.slug}`}>{s.slug}</Link>
                </td>
                <td>{s.owner_phone}</td>
                <td>{s.status}</td>
                <td>
                  <Link href={`/platform/shops/${s.id}/stock`}>Stock</Link>
                  {" · "}
                  <Link href={`/platform/shops/${s.id}/reports`}>Report</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
