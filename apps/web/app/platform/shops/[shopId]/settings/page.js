"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Form, Nav, Row, Tab } from "react-bootstrap";
import GstSettingsForm from "../../../../../components/admin/GstSettingsForm";
import { api, getToken } from "../../../../../lib/api";
import { createPlatformCatalogApi } from "../../../../../lib/catalogApi";
import { formatRate } from "../../../../../components/admin/GstRateSelect";

export default function PlatformShopSettingsPage() {
  const { shopId } = useParams();
  const catalogApi = useMemo(() => createPlatformCatalogApi(shopId), [shopId]);
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", owner_phone: "", shop_mode: "both" });
  const [gst, setGst] = useState({ gst_enabled: false, gst_rate: 18, gst_rates: [] });
  const [tab, setTab] = useState("shop");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    return api.platform.shops.get(Number(shopId), getToken("platform")).then((info) => {
      setShop(info);
      setForm({
        name: info.name || "",
        description: info.description || "",
        owner_phone: info.owner_phone || "",
        shop_mode: info.shop_mode || "both",
      });
      setGst({
        gst_enabled: !!info.gst_enabled,
        gst_rate: Number(info.gst_rate ?? 18),
        gst_rates: Array.isArray(info.gst_rates) ? info.gst_rates.map(Number) : [],
      });
      return info;
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when shopId changes
  }, [shopId]);

  async function saveShop(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await catalogApi.updateSettings({
        name: form.name,
        description: form.description,
        owner_phone: form.owner_phone,
      });
      // shop_mode lives on the shop PATCH endpoint, not settings
      if (form.shop_mode && form.shop_mode !== shop?.shop_mode) {
        await api.platform.shops.update(Number(shopId), { shop_mode: form.shop_mode }, getToken("platform"));
      }
      await load();
      setMessage("Shop details saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveGst(payload) {
    const result = await catalogApi.updateSettings(payload);
    const next = {
      gst_enabled: !!result.gst_enabled,
      gst_rate: Number(result.gst_rate ?? payload.gst_rate),
      gst_rates: Array.isArray(result.gst_rates) ? result.gst_rates.map(Number) : payload.gst_rates,
    };
    setGst(next);
    setShop((s) => (s ? { ...s, ...next } : s));
    return next;
  }

  const gstSummary = gst.gst_enabled
    ? gst.gst_rates.length
      ? `On · ${gst.gst_rates.map(formatRate).join(", ")} (default ${formatRate(gst.gst_rate)})`
      : `On · default ${formatRate(gst.gst_rate)}`
    : "Off";

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
        <div>
          <h2 className="mb-1">{shop?.name || "Shop"} — Settings</h2>
          <p className="text-muted mb-0">
            {shop?.slug ? (
              <>
                Platform controls for{" "}
                <Link href={`/${shop.slug}`} target="_blank">
                  /{shop.slug}
                </Link>
                {" · "}
              </>
            ) : null}
            GST: {gstSummary}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link href={`/platform/shops/${shopId}/barcodes`} className="btn btn-outline-primary">
            Barcode labels
          </Link>
          <Link href={`/platform/shops/${shopId}/stock`} className="btn btn-outline-secondary">
            Stock &amp; catalog
          </Link>
          <Link href="/platform/shops" className="btn btn-outline-secondary">
            All shops
          </Link>
        </div>
      </div>

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Tab.Container activeKey={tab} onSelect={(k) => setTab(k || "shop")}>
        <Card>
          <Card.Header className="bg-white">
            <Nav variant="tabs" className="card-header-tabs">
              <Nav.Item>
                <Nav.Link eventKey="shop">Shop info</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="gst">GST / Billing</Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>
          <Card.Body>
            <Tab.Content>
              <Tab.Pane eventKey="shop">
                <Form onSubmit={saveShop}>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Shop name</Form.Label>
                        <Form.Control
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Owner phone</Form.Label>
                        <Form.Control
                          value={form.owner_phone}
                          onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Shop mode</Form.Label>
                        <Form.Select
                          value={form.shop_mode}
                          onChange={(e) => setForm({ ...form, shop_mode: e.target.value })}
                        >
                          <option value="billing">Billing only (counter)</option>
                          <option value="commerce">Commerce only (online)</option>
                          <option value="both">Both</option>
                        </Form.Select>
                        <Form.Text muted>
                          Billing-only shops get counter tools (billing, barcodes, products &amp; GST).
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Button type="submit" className="mt-3" disabled={saving}>
                    {saving ? "Saving…" : "Save shop details"}
                  </Button>
                </Form>
              </Tab.Pane>
              <Tab.Pane eventKey="gst">
                <GstSettingsForm value={gst} onSave={saveGst} />
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>
    </>
  );
}
