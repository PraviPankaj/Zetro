"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Form, Row } from "react-bootstrap";
import { api, getToken } from "../../../../lib/api";

const PROVIDERS = [
  { id: "cod", label: "Cash on delivery" },
  { id: "razorpay", label: "Razorpay" },
  { id: "cashfree", label: "Cashfree" },
];

export default function ShopPaymentsPage() {
  const { slug } = useParams();
  const [gateways, setGateways] = useState([]);
  const [message, setMessage] = useState("");
  const [forms, setForms] = useState({
    razorpay: { key_id: "", key_secret: "", enabled: false },
    cashfree: { app_id: "", secret: "", enabled: false },
    cod: { enabled: true },
  });

  function load() {
    api.shop(slug).gateways.list(getToken("shop", slug)).then((list) => {
      setGateways(list);
      const next = { ...forms };
      list.forEach((g) => {
        if (next[g.provider]) next[g.provider].enabled = g.is_enabled;
      });
      setForms(next);
    });
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function save(provider) {
    setMessage("");
    const f = forms[provider];
    const credentials =
      provider === "razorpay"
        ? { key_id: f.key_id, key_secret: f.key_secret }
        : provider === "cashfree"
          ? { app_id: f.app_id, secret: f.secret }
          : {};
    await api.shop(slug).gateways.upsert(
      { provider, is_enabled: !!f.enabled, credentials, settings: {} },
      getToken("shop", slug)
    );
    setMessage(`${provider} saved`);
    load();
  }

  return (
    <>
      <h2 className="mb-1">Payment gateways</h2>
      <p className="text-muted">Online payments are optional. COD is available by default.</p>
      {message ? <Alert variant="success">{message}</Alert> : null}
      <Row>
        {PROVIDERS.map((p) => (
          <Col md={4} key={p.id} className="mb-3">
            <Card>
              <Card.Body>
                <h4>{p.label}</h4>
                <Form.Check
                  type="switch"
                  label="Enabled"
                  checked={!!forms[p.id]?.enabled}
                  onChange={(e) =>
                    setForms({ ...forms, [p.id]: { ...forms[p.id], enabled: e.target.checked } })
                  }
                />
                {p.id === "razorpay" ? (
                  <>
                    <Form.Control
                      className="mt-2"
                      placeholder="Key ID"
                      value={forms.razorpay.key_id}
                      onChange={(e) =>
                        setForms({ ...forms, razorpay: { ...forms.razorpay, key_id: e.target.value } })
                      }
                    />
                    <Form.Control
                      className="mt-2"
                      placeholder="Key secret"
                      type="password"
                      value={forms.razorpay.key_secret}
                      onChange={(e) =>
                        setForms({
                          ...forms,
                          razorpay: { ...forms.razorpay, key_secret: e.target.value },
                        })
                      }
                    />
                  </>
                ) : null}
                {p.id === "cashfree" ? (
                  <>
                    <Form.Control
                      className="mt-2"
                      placeholder="App ID"
                      value={forms.cashfree.app_id}
                      onChange={(e) =>
                        setForms({ ...forms, cashfree: { ...forms.cashfree, app_id: e.target.value } })
                      }
                    />
                    <Form.Control
                      className="mt-2"
                      placeholder="Secret"
                      type="password"
                      value={forms.cashfree.secret}
                      onChange={(e) =>
                        setForms({ ...forms, cashfree: { ...forms.cashfree, secret: e.target.value } })
                      }
                    />
                  </>
                ) : null}
                <Button className="mt-3" onClick={() => save(p.id)}>
                  Save
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
