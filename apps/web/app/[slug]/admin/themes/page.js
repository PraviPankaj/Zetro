"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Badge, Button, Card, Col, Row } from "react-bootstrap";
import ThemeVariableForm from "../../../../components/admin/ThemeVariableForm";
import { STORE_THEMES } from "../../../../lib/storeThemes";
import { api, getToken } from "../../../../lib/api";

function ThemeCard({ theme, active, onSelect, disabled }) {
  const isHtml = theme.type === "html";
  const swatch = isHtml
    ? ["#6366f1", "#e0e7ff"]
    : STORE_THEMES.find((t) => t.id === theme.id)?.swatch || ["#111", "#eee"];

  return (
    <button
      type="button"
      className={`theme-picker-card${active ? " is-active" : ""}`}
      disabled={disabled}
      onClick={() => onSelect(theme.id)}
    >
      <div className="theme-picker-swatches">
        {swatch.map((color) => (
          <span key={color} style={{ background: color }} />
        ))}
      </div>
      <strong>{theme.name}</strong>
      <small>
        {isHtml
          ? theme.description || "HTML theme — configure images & text below"
          : theme.id.replace("-", " ")}
      </small>
      {isHtml && theme.variables?.length ? (
        <Badge bg="info" className="mt-1">
          {theme.variables.length} fields
        </Badge>
      ) : null}
    </button>
  );
}

export default function ShopThemesPage() {
  const { slug } = useParams();
  const token = () => getToken("shop", slug);
  const shopApi = useMemo(() => api.shop(slug), [slug]);

  const [themeData, setThemeData] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState("playful");
  const [config, setConfig] = useState({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    shopApi.theme
      .get(token())
      .then((data) => {
        setThemeData(data);
        setSelectedTheme(data.storefront_theme || "playful");
        setConfig(data.theme_config || {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, shopApi]);

  const available = themeData?.available_themes || [];
  const selected = available.find((t) => t.id === selectedTheme);
  const isHtml = selected?.type === "html";
  const variables = isHtml ? selected.variables || [] : [];
  const instructions = isHtml ? selected.instructions : null;

  async function saveTheme(activate) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await shopApi.theme.update(
        { theme_slug: selectedTheme, theme_config: config, activate },
        token()
      );
      setThemeData(result);
      setSelectedTheme(result.storefront_theme);
      setMessage(activate ? "Theme is live on your storefront!" : "Theme saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadPreview() {
    setError("");
    try {
      await shopApi.theme.update(
        { theme_slug: selectedTheme, theme_config: config, activate: false },
        token()
      );
      const result = await shopApi.theme.preview(token());
      setPreviewHtml(result.html || "");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <>
      <div className="admin-page-header">
        <h2 className="mb-1">Themes</h2>
        <p className="text-muted mb-0">
          Choose a storefront theme and fill in the content fields for your shop
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
              <strong>Choose theme</strong>
            </Card.Header>
            <Card.Body>
              <div className="theme-picker-grid">
                {available.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    active={selectedTheme === theme.id}
                    disabled={saving}
                    onSelect={setSelectedTheme}
                  />
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          {isHtml ? (
            <Card className="mb-4">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <strong>Your theme content</strong>
                {variables.length ? (
                  <Badge bg="primary">{variables.length} fields</Badge>
                ) : null}
              </Card.Header>
              <Card.Body>
                {instructions ? (
                  <Alert variant="info" className="small">
                    {instructions}
                  </Alert>
                ) : null}
                <ThemeVariableForm
                  variables={variables}
                  config={config}
                  onChange={setConfig}
                  onUploadAsset={(file) => shopApi.theme.uploadAsset(file, token())}
                />
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Button variant="outline-primary" disabled={saving} onClick={() => saveTheme(false)}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="primary" disabled={saving} onClick={() => saveTheme(true)}>
                    {saving ? "Launching…" : "Save & launch"}
                  </Button>
                  <Button variant="outline-secondary" onClick={loadPreview}>
                    Preview
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ) : (
            <Card className="mb-4">
              <Card.Body>
                <p className="text-muted mb-3">
                  This is a built-in color theme — no extra fields needed. Click launch to apply it.
                </p>
                <Button variant="primary" disabled={saving} onClick={() => saveTheme(true)}>
                  {saving ? "Applying…" : "Apply theme"}
                </Button>
              </Card.Body>
            </Card>
          )}

          {previewHtml ? (
            <Card>
              <Card.Header className="bg-white">
                <strong>Preview</strong>
              </Card.Header>
              <Card.Body className="p-0">
                <iframe
                  title="Theme preview"
                  srcDoc={previewHtml}
                  style={{ width: "100%", minHeight: 480, border: "none" }}
                  sandbox="allow-same-origin"
                />
              </Card.Body>
            </Card>
          ) : null}
        </Col>
      </Row>
    </>
  );
}
