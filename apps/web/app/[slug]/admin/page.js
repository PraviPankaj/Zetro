"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Alert, Card, Col, Row } from "react-bootstrap";
import { api, getToken } from "../../../lib/api";

export default function ShopAdminHome() {
  const { slug } = useParams();
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const token = getToken("shop", slug);
    const shop = api.shop(slug);
    shop.adminMe(token).then(setMe);
    shop.subscription(token).then(setSub).catch(() => setSub(null));
    shop.products.list(token).then(setProducts).catch(() => setProducts([]));
    shop.orders.list(token).then(setOrders).catch(() => setOrders([]));
  }, [slug]);

  return (
    <>
      <h2 className="mb-1">{me?.shop?.name}</h2>
      <p className="text-muted">
        Storefront at /{slug} · signed in as {me?.user?.phone}
      </p>
      {!sub ? (
        <Alert variant="warning">
          No active plan. <Link href={`/${slug}/admin/plans`}>Choose a plan</Link> to add stock.
        </Alert>
      ) : (
        <Alert variant="success">
          {sub.plan?.name} · {sub.status} until {new Date(sub.ends_at).toLocaleDateString()}
        </Alert>
      )}
      <Row>
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="text-muted">Products</div>
              <h2>{products.length}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="text-muted">Orders</div>
              <h2>{orders.length}</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
