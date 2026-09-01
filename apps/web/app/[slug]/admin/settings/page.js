"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Col, Form, Nav, Row, Tab } from "react-bootstrap";
import ThemePicker from "../../../../components/admin/ThemePicker";
import { api } from "../../../../lib/api";
import { createShopCatalogApi } from "../../../../lib/catalogApi";

export default function ShopSettingsPage() {
  const { slug } = useParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", owner_phone: "" });
  const [theme, setTheme] = useState("playful");
  const [logoFile, setLogoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    api.shop(slug).info().then((info) => {
      setShop(info);
      setForm({
        name: info.name || "",
        description: info.description || "",
        owner_phone: info.owner_phone || "",
      });
      setTheme(info.storefront_theme || "playful");
    });
  }, [slug]);

  async function saveShopInfo(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await catalogApi.updateSettings({
        name: form.name,
        description: form.description,
        owner_phone: form.owner_phone,
      });
      if (logoFile) {
        const result = await catalogApi.uploadLogo(logoFile);
        setShop((prev) => ({ ...prev, logo_url: result.logo_url }));
        setLogoFile(null);
      }
      setMessage("Shop settings saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onThemeChange(themeId) {
    setThemeSaving(true);
    setError("");
    try {
      await catalogApi.updateSettings({ storefront_theme: themeId });
      setTheme(themeId);
      setMessage("Theme updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setThemeSaving(false);
    }
  }

  const logoPreview = logoFile
    ? URL.createObjectURL(logoFile)
    : shop?.logo_url
      ? api.mediaUrl(shop.logo_url)
      : null;

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Settings</h2>
        <p className="text-muted mb-0">Manage your shop profile and storefront appearance</p>
      </div>

      {message ? (
        <Alert variant="success" onClose={() => setMessage("")} dismissible>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      ) : null}

      <Tab.Container defaultActiveKey="shop">
        <Card>
          <Card.Header className="bg-white">
            <Nav variant="tabs" className="card-header-tabs">
              <Nav.Item>
                <Nav.Link eventKey="shop">Shop info</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="theme">Storefront theme</Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>
          <Card.Body>
            <Tab.Content>
              <Tab.Pane eventKey="shop">
                <Form onSubmit={saveShopInfo}>
                  <Row>
                    <Col md={8}>
                      <Form.Group className="mb-3">
                        <Form.Label>Shop name</Form.Label>
                        <Form.Control
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Tell customers about your shop"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Contact phone</Form.Label>
                        <Form.Control
                          value={form.owner_phone}
                          onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                          placeholder="10-digit mobile number"
                        />
                      </Form.Group>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving…" : "Save shop info"}
                      </Button>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Shop logo</Form.Label>
                        {logoPreview ? (
                          <div className="mb-2">
                            <img
                              src={logoPreview}
                              alt="Logo"
                              style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 8, border: "1px solid #dee2e6" }}
                            />
                          </div>
                        ) : (
                          <div
                            className="mb-2 d-flex align-items-center justify-content-center text-muted"
                            style={{ width: 120, height: 120, borderRadius: 8, border: "1px dashed #dee2e6" }}
                          >
                            No logo
                          </div>
                        )}
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        />
                        <Form.Text className="text-muted">PNG, JPG or WebP. Saved with shop info.</Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>
              </Tab.Pane>
              <Tab.Pane eventKey="theme">
                <p className="text-muted mb-3">
                  Choose how your customer-facing shop looks. Changes apply immediately on the storefront.
                </p>
                <ThemePicker value={theme} onChange={onThemeChange} saving={themeSaving} />
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>
    </>
  );
}
