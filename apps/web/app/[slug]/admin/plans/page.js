"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Row } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";

export default function ShopPlansPage() {
  const { slug } = useParams();
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    const token = getToken("shop", slug);
    api.shop(slug).plans(token).then(setPlans);
    api.shop(slug).subscription(token).then(setSub);
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function activate(code) {
    setError("");
    setMessage("");
    try {
      await api.shop(slug).activatePlan(code, getToken("shop", slug));
      setMessage("Plan activated");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2 className="mb-1">Plans</h2>
      <p className="text-muted">Start with a 7-day free trial, then move to Pro.</p>
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {sub ? (
        <Alert variant="info">
          Current: {sub.plan?.name} ({sub.status}) until {new Date(sub.ends_at).toLocaleDateString()}
        </Alert>
      ) : null}
      <Row>
        {plans.map((plan) => (
          <Col md={4} key={plan.id} className="mb-3">
            <Card>
              <Card.Body className="p-6">
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <h2 className="fw-bold">₹{Number(plan.price)}</h2>
                <p className="text-muted">{plan.duration_days} days</p>
                <Button onClick={() => activate(plan.code)}>
                  {plan.is_trial ? "Start free trial" : "Take this plan"}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
