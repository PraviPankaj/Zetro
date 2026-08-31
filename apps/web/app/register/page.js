"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form } from "react-bootstrap";
import AuthCard from "../../components/admin/AuthCard";
import { api, setTokens } from "../../lib/api";

function slugPreview(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const suggestedSlug = useMemo(() => slugPreview(shopName), [shopName]);
  const effectiveSlug = slugTouched ? shopSlug : suggestedSlug;

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.register.requestOtp(phone);
      setDevOtp(res.dev_otp || "");
      setStep("otp");
    } catch (err) {
      setError(err.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.register.verifyOtp(phone, otp);
      setRegistrationToken(res.registration_token);
      setStep("shop");
    } catch (err) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  function onLogoChange(e) {
    const file = e.target.files?.[0];
    setLogo(file || null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : "");
  }

  async function createShop(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.register.createShop(registrationToken, {
        name: shopName.trim(),
        slug: effectiveSlug || undefined,
        logo,
      });
      setTokens("shop", res.shop.slug, res);
      router.push(`/${res.shop.slug}/admin/products`);
    } catch (err) {
      setError(err.message || "Could not create shop");
    } finally {
      setLoading(false);
    }
  }

  const subtitles = {
    phone: "Start your shop — verify your mobile number with OTP.",
    otp: `Enter the OTP sent to ${phone}.`,
    shop: "Almost done — name your shop and add a logo if you have one.",
  };

  return (
    <AuthCard subtitle={subtitles[step]}>
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {step === "phone" ? (
        <Form onSubmit={requestOtp}>
          <Form.Group className="mb-3">
            <Form.Label>Mobile number</Form.Label>
            <Form.Control
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Form.Text className="text-muted">Indian mobile numbers only (+91).</Form.Text>
          </Form.Group>
          <div className="d-grid">
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </Button>
          </div>
        </Form>
      ) : null}

      {step === "otp" ? (
        <Form onSubmit={verifyOtp}>
          {devOtp ? <Alert variant="info">Dev OTP: {devOtp}</Alert> : null}
          <Form.Group className="mb-3">
            <Form.Label>OTP</Form.Label>
            <Form.Control
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </Form.Group>
          <div className="d-grid gap-2">
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Verify OTP"}
            </Button>
            <Button variant="link" type="button" onClick={() => setStep("phone")}>
              Change number
            </Button>
          </div>
        </Form>
      ) : null}

      {step === "shop" ? (
        <Form onSubmit={createShop}>
          <Form.Group className="mb-3">
            <Form.Label>Shop name</Form.Label>
            <Form.Control
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="ABC Kids"
              required
              minLength={2}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Store URL</Form.Label>
            <div className="input-group">
              <span className="input-group-text">zetro.app/</span>
              <Form.Control
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setShopSlug(e.target.value);
                }}
                placeholder={suggestedSlug || "your-shop"}
              />
            </div>
            <Form.Text className="text-muted">Lowercase letters, numbers, and hyphens.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Logo (optional)</Form.Label>
            <Form.Control type="file" accept="image/*" onChange={onLogoChange} />
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="mt-2 rounded"
                style={{ maxHeight: 80, maxWidth: 160, objectFit: "contain" }}
              />
            ) : null}
          </Form.Group>
          <div className="d-grid">
            <Button variant="primary" type="submit" disabled={loading || shopName.trim().length < 2}>
              {loading ? "Creating shop…" : "Create my shop"}
            </Button>
          </div>
        </Form>
      ) : null}
    </AuthCard>
  );
}
