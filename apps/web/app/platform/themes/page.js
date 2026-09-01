"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { api, getToken } from "../../../lib/api";

export default function PlatformThemesPage() {
  const token = () => getToken("platform");
  const [themes, setThemes] = useState([]);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [htmlFile, setHtmlFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadThemes() {
    return api.platform.themes.list(token()).then(setThemes);
  }

  useEffect(() => {
    async function init() {
      try {
        let list = await api.platform.themes.list(token());
        const empty = list.filter((t) => !(t.variables && t.variables.length));
        if (empty.length) {
          setMessage(`Re-analyzing ${empty.length} theme(s) that had no fields…`);
          await Promise.all(empty.map((t) => api.platform.themes.reanalyze(t.slug, token())));
          list = await api.platform.themes.list(token());
        }
        setThemes(list);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function uploadTheme(e) {
    e.preventDefault();
    if (!htmlFile || !form.name.trim()) {
      setError("Theme name and HTML file are required");
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const created = await api.platform.themes.upload(htmlFile, form, token());
      setMessage(
        `Theme "${created.name}" uploaded — ${created.variables?.length || 0} fields detected (${created.variables?.filter((v) => !v.auto).length || 0} for shops to fill in).`
      );
      setForm({ name: "", slug: "", description: "" });
      setHtmlFile(null);
      await loadThemes();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(theme) {
    try {
      await api.platform.themes.update(theme.slug, { is_active: !theme.is_active }, token());
      await loadThemes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reanalyze(theme) {
    try {
      await api.platform.themes.reanalyze(theme.slug, token());
      setMessage(`Re-analyzed "${theme.name}" with ChatGPT`);
      await loadThemes();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Storefront themes</h2>
        <p className="text-muted mb-0">
          Upload HTML themes for all shops. ChatGPT detects variables shops must fill in.
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

      <Row className="g-4">
        <Col lg={5}>
          <Card>
            <Card.Header className="bg-white">
              <strong>Upload new theme</strong>
            </Card.Header>
            <Card.Body>
              <p className="text-muted small">
                Use <code>{`{{variable_name}}`}</code> placeholders in HTML — e.g.{" "}
                <code>{`{{logo}}`}</code>, <code>{`{{hero_carousel_1_image}}`}</code>,{" "}
                <code>{`{{products_catalog}}`}</code>.
              </p>
              <Form onSubmit={uploadTheme}>
                <Form.Group className="mb-3">
                  <Form.Label>Theme name</Form.Label>
                  <Form.Control
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Kids Hero Store"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Slug (optional)</Form.Label>
                  <Form.Control
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="kids-hero-store"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>HTML file</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".html,.htm"
                    onChange={(e) => setHtmlFile(e.target.files?.[0] || null)}
                  />
                </Form.Group>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Uploading & analyzing…" : "Upload & analyze with ChatGPT"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card>
            <Card.Header className="bg-white">
              <strong>Published themes</strong>
            </Card.Header>
            <Card.Body className="p-0">
              {themes.length === 0 ? (
                <p className="text-muted p-3 mb-0">No HTML themes yet.</p>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Slug</th>
                      <th>Variables</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {themes.map((t) => (
                      <tr key={t.slug}>
                        <td>
                          <strong>{t.name}</strong>
                          {t.description ? (
                            <div className="text-muted small">{t.description}</div>
                          ) : null}
                        </td>
                        <td>
                          <code>{t.slug}</code>
                        </td>
                        <td>
                          <Badge bg="info" className="me-1">
                            {(t.variables || []).filter((v) => !v.auto).length} shop
                          </Badge>
                          <Badge bg="secondary">{(t.variables || []).length} total</Badge>
                        </td>
                        <td>
                          <Badge bg={t.is_active ? "success" : "secondary"}>
                            {t.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="me-1"
                            onClick={() => reanalyze(t)}
                          >
                            Re-analyze
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => toggleActive(t)}
                          >
                            {t.is_active ? "Disable" : "Enable"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
