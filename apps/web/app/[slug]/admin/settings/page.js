"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Alert } from "react-bootstrap";
import ThemePicker from "../../../../components/admin/ThemePicker";
import { api, getToken } from "../../../../lib/api";
import { createShopCatalogApi } from "../../../../lib/catalogApi";

export default function ShopSettingsPage() {
  const { slug } = useParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);
  const [theme, setTheme] = useState("playful");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.shop(slug).info().then((shop) => setTheme(shop.storefront_theme || "playful"));
  }, [slug]);

  async function onThemeChange(themeId) {
    setSaving(true);
    setMessage("");
    try {
      await catalogApi.updateSettings({ storefront_theme: themeId });
      setTheme(themeId);
      setMessage("Storefront theme updated. Open your shop to preview.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="mb-4">Storefront settings</h2>
      {message ? (
        <Alert variant={message.includes("updated") ? "success" : "danger"}>{message}</Alert>
      ) : null}
      <p className="text-muted">
        Choose how your customer-facing shop looks. Changes apply immediately on the storefront.
      </p>
      <ThemePicker value={theme} onChange={onThemeChange} saving={saving} />
    </>
  );
}
