"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Col, Form, Nav, Row, Tab } from "react-bootstrap";
import { api } from "../../../../lib/api";
import { createShopCatalogApi } from "../../../../lib/catalogApi";

export default function ShopSettingsPage() {
  const { slug } = useParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", owner_phone: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [seo, setSeo] = useState({ meta_title: "", meta_description: "" });
  const [blocks, setBlocks] = useState([]);
  const [gst, setGst] = useState({ gst_enabled: false, gst_rate: 18 });

  useEffect(() => {
    api.shop(slug).info().then((info) => {
      setShop(info);
      setForm({
        name: info.name || "",
        description: info.description || "",
        owner_phone: info.owner_phone || "",
      });
      setSeo({
        meta_title: info.meta_title || "",
        meta_description: info.meta_description || "",
      });
      setBlocks(info.homepage_blocks || []);
      setGst({
        gst_enabled: !!info.gst_enabled,
        gst_rate: Number(info.gst_rate ?? 18),
      });
    });
  }, [slug]);

  async function saveSeo(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await catalogApi.updateSettings(seo);
      setMessage("SEO settings saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveHomepage(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await catalogApi.updateSettings({ homepage_blocks: blocks });
      setMessage("Homepage updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveGst(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await catalogApi.updateSettings({
        gst_enabled: gst.gst_enabled,
        gst_rate: Number(gst.gst_rate) || 0,
      });
      setGst({
        gst_enabled: !!result.gst_enabled,
        gst_rate: Number(result.gst_rate ?? gst.gst_rate),
      });
      setMessage("GST settings saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function addBlock() {
    setBlocks([
      ...blocks,
      {
        id: `block-${Date.now()}`,
        type: "hero",
        title: "",
        subtitle: "",
        image_url: "",
        cta: "Shop now",
        href: `/${slug}#catalog`,
      },
    ]);
  }

  function updateBlock(index, field, value) {
    setBlocks(blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function removeBlock(index) {
    setBlocks(blocks.filter((_, i) => i !== index));
  }

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

  const logoPreview = logoFile
    ? URL.createObjectURL(logoFile)
    : shop?.logo_url
      ? api.mediaUrl(shop.logo_url)
      : null;

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Settings</h2>
        <p className="text-muted mb-0">
          {shop?.shop_mode === "billing"
            ? "Manage your shop profile and GST for counter billing."
            : (
              <>
                Manage your shop profile. For storefront themes, go to{" "}
                <Link href={`/${slug}/admin/themes`}>Themes</Link>.
              </>
            )}
        </p>
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
              {shop?.shop_mode !== "billing" ? (
                <>
                  <Nav.Item>
                    <Nav.Link eventKey="seo">SEO</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="homepage">Homepage</Nav.Link>
                  </Nav.Item>
                </>
              ) : null}
              <Nav.Item>
                <Nav.Link eventKey="gst">GST / Billing</Nav.Link>
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
              <Tab.Pane eventKey="seo">
                <Form onSubmit={saveSeo}>
                  <Form.Group className="mb-3">
                    <Form.Label>Meta title</Form.Label>
                    <Form.Control
                      value={seo.meta_title}
                      onChange={(e) => setSeo({ ...seo, meta_title: e.target.value })}
                      placeholder="Shown in browser tab and search results"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Meta description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={seo.meta_description}
                      onChange={(e) => setSeo({ ...seo, meta_description: e.target.value })}
                      placeholder="Short description for search engines"
                    />
                  </Form.Group>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save SEO"}
                  </Button>
                </Form>
              </Tab.Pane>
              <Tab.Pane eventKey="homepage">
                <p className="text-muted">
                  Custom hero slides for preset themes. HTML themes use the Themes page instead.
                </p>
                <div className="d-flex justify-content-end mb-3">
                  <Button variant="outline-primary" size="sm" onClick={addBlock}>
                    Add slide
                  </Button>
                </div>
                <Form onSubmit={saveHomepage}>
                  {blocks.map((block, index) => (
                    <Card key={block.id} className="mb-3">
                      <Card.Body>
                        <div className="d-flex justify-content-between mb-2">
                          <strong>Slide {index + 1}</strong>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            type="button"
                            onClick={() => removeBlock(index)}
                          >
                            Remove
                          </Button>
                        </div>
                        <Row className="g-2">
                          <Col md={6}>
                            <Form.Control
                              className="mb-2"
                              placeholder="Title"
                              value={block.title}
                              onChange={(e) => updateBlock(index, "title", e.target.value)}
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Control
                              className="mb-2"
                              placeholder="Image URL"
                              value={block.image_url}
                              onChange={(e) => updateBlock(index, "image_url", e.target.value)}
                            />
                          </Col>
                          <Col md={12}>
                            <Form.Control
                              className="mb-2"
                              placeholder="Subtitle"
                              value={block.subtitle}
                              onChange={(e) => updateBlock(index, "subtitle", e.target.value)}
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Control
                              placeholder="Button text"
                              value={block.cta}
                              onChange={(e) => updateBlock(index, "cta", e.target.value)}
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Control
                              placeholder="Link (e.g. /abc#catalog)"
                              value={block.href}
                              onChange={(e) => updateBlock(index, "href", e.target.value)}
                            />
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  ))}
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save homepage"}
                  </Button>
                </Form>
              </Tab.Pane>
              <Tab.Pane eventKey="gst">
                <Form onSubmit={saveGst}>
                  <p className="text-muted">
                    Control GST on in-shop billing. Default is off. Online checkout is unchanged.
                  </p>
                  <Form.Check
                    type="switch"
                    className="mb-3"
                    id="gst-enabled"
                    label="Enable GST on shop bills"
                    checked={!!gst.gst_enabled}
                    onChange={(e) => setGst({ ...gst, gst_enabled: e.target.checked })}
                  />
                  <Form.Group className="mb-3" style={{ maxWidth: 200 }}>
                    <Form.Label>GST rate (%)</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={gst.gst_rate}
                      disabled={!gst.gst_enabled}
                      onChange={(e) => setGst({ ...gst, gst_rate: e.target.value })}
                    />
                  </Form.Group>
                  <p className="small text-muted">
                    Bills always round to the nearest rupee. GST applies only when enabled here.
                  </p>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save GST settings"}
                  </Button>
                </Form>
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>
    </>
  );
}
