"use client";

import { useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { api } from "../../lib/api";

function ImageField({ variable, value, onChange, onUpload, uploading }) {
  const preview = value ? api.mediaUrl(value) : null;
  const w = variable.width || 800;
  const h = variable.height || 600;

  return (
    <div>
      {preview ? (
        <img
          src={preview}
          alt={variable.label}
          className="mb-2 d-block"
          style={{ maxWidth: 200, maxHeight: 120, objectFit: "contain", borderRadius: 8, border: "1px solid #dee2e6" }}
        />
      ) : (
        <div
          className="mb-2 text-muted d-flex align-items-center justify-content-center"
          style={{ width: 200, height: 100, borderRadius: 8, border: "1px dashed #dee2e6", fontSize: "0.85rem" }}
        >
          No image
        </div>
      )}
      <Form.Text className="d-block mb-2 text-muted">
        Recommended: {w}×{h}px
      </Form.Text>
      <Form.Control
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = await onUpload(file);
          onChange(url);
        }}
      />
    </div>
  );
}

function CarouselField({ variable, value, onChange, onUpload, uploading }) {
  const count = variable.count || 4;
  const slides = Array.isArray(value) ? value : [];
  const w = variable.slide_width || 1200;
  const h = variable.slide_height || 600;

  function updateSlide(index, field, val) {
    const next = [...slides];
    while (next.length <= index) next.push({});
    next[index] = { ...next[index], [field]: val };
    onChange(next);
  }

  return (
    <div>
      <Form.Text className="d-block mb-3 text-muted">
        Upload {count} slide{count > 1 ? "s" : ""} — recommended size {w}×{h}px each
      </Form.Text>
      {Array.from({ length: count }, (_, i) => {
        const slide = slides[i] || {};
        const preview = slide.image ? api.mediaUrl(slide.image) : null;
        return (
          <div key={i} className="border rounded p-3 mb-3 bg-light">
            <strong className="d-block mb-2">Slide {i + 1}</strong>
            <Row className="g-2">
              <Col md={4}>
                {preview ? (
                  <img
                    src={preview}
                    alt={`Slide ${i + 1}`}
                    style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div
                    className="text-muted d-flex align-items-center justify-content-center"
                    style={{ height: 80, borderRadius: 8, border: "1px dashed #ccc", fontSize: "0.8rem" }}
                  >
                    No image
                  </div>
                )}
                <Form.Control
                  type="file"
                  accept="image/*"
                  className="mt-2"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await onUpload(file);
                    updateSlide(i, "image", url);
                  }}
                />
              </Col>
              <Col md={8}>
                <Form.Control
                  className="mb-2"
                  placeholder="Title (optional)"
                  value={slide.title || ""}
                  onChange={(e) => updateSlide(i, "title", e.target.value)}
                />
                <Form.Control
                  placeholder="Subtitle (optional)"
                  value={slide.subtitle || ""}
                  onChange={(e) => updateSlide(i, "subtitle", e.target.value)}
                />
              </Col>
            </Row>
          </div>
        );
      })}
    </div>
  );
}

export default function ThemeVariableForm({ variables, config, onChange, onUploadAsset }) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file) {
    setUploading(true);
    try {
      const result = await onUploadAsset(file);
      return result.url;
    } finally {
      setUploading(false);
    }
  }

  function setValue(key, val) {
    onChange({ ...config, [key]: val });
  }

  if (!variables?.length) {
    return (
      <p className="text-muted mb-0">
        No fields detected yet. Ask Zetro platform admin to re-analyze the theme, or upload HTML with{" "}
        <code>{`{{variable_name}}`}</code> placeholders.
      </p>
    );
  }

  const manualVars = variables.filter((v) => !v.auto && !["shop_name", "shop_description", "shop_logo", "products_catalog"].includes(v.key));

  return (
    <div>
      {manualVars.length === 0 ? (
        <p className="text-muted mb-3">
          This theme uses your shop name, logo, description and product catalog automatically — no extra uploads needed.
        </p>
      ) : null}
      {variables.map((variable) => {
        const key = variable.key;
        const value = config[key] ?? "";
        const builtIn =
          variable.auto ||
          ["shop_name", "shop_description", "shop_logo", "products_catalog"].includes(key);

        return (
          <Form.Group key={key} className="mb-4">
            <Form.Label>
              {variable.label || key}
              {variable.required ? " *" : ""}
              {builtIn ? (
                <Form.Text className="ms-2 text-muted">(auto-filled from shop data)</Form.Text>
              ) : null}
            </Form.Label>

            {builtIn ? (
              <Form.Text className="d-block text-muted">
                {variable.description || "Filled automatically from your shop when the theme is live."}
              </Form.Text>
            ) : variable.type === "carousel" ? (
              <CarouselField
                variable={variable}
                value={value}
                onChange={(v) => setValue(key, v)}
                onUpload={handleUpload}
                uploading={uploading}
              />
            ) : variable.type === "image" ? (
              <ImageField
                variable={variable}
                value={value}
                onChange={(v) => setValue(key, v)}
                onUpload={handleUpload}
                uploading={uploading}
              />
            ) : variable.type === "textarea" ? (
              <Form.Control
                as="textarea"
                rows={3}
                value={value}
                onChange={(e) => setValue(key, e.target.value)}
              />
            ) : variable.type === "color" ? (
              <Form.Control
                type="color"
                value={value || "#000000"}
                onChange={(e) => setValue(key, e.target.value)}
              />
            ) : (
              <Form.Control value={value} onChange={(e) => setValue(key, e.target.value)} />
            )}
          </Form.Group>
        );
      })}
      {uploading ? <p className="text-muted small">Uploading image…</p> : null}
    </div>
  );
}
