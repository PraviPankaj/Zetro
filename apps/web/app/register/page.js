"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form } from "react-bootstrap";
import { Check, CreditCard, Layers, ShoppingCart } from "react-feather";
import AuthCard from "../../components/admin/AuthCard";
import { api, setTokens } from "../../lib/api";
import {
  confirmFirebaseOtp,
  isFirebasePhoneAuthEnabled,
  sendFirebasePhoneOtp,
} from "../../lib/firebase";

const REGISTER_TOKEN_KEY = "zetro_registration_token";
const REGISTER_PHONE_KEY = "zetro_registration_phone";

function slugPreview(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const MODE_OPTIONS = [
  {
    id: "billing",
    title: "Billing only",
    blurb: "Counter sales with barcode stock-in, bills, and refunds. No online storefront cart.",
    points: ["Barcode stock", "POS billing", "Bills & cancel/refund"],
    Icon: CreditCard,
  },
  {
    id: "commerce",
    title: "Shopping cart",
    blurb: "Online catalogue and checkout for customers browsing your store.",
    points: ["Product catalogue", "Cart & online orders", "Themes & coupons"],
    Icon: ShoppingCart,
  },
  {
    id: "both",
    title: "Both",
    blurb: "Run the counter and the online shop together from one admin.",
    points: ["Everything in Billing", "Everything in Shopping cart"],
    Icon: Layers,
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [registrationToken, setRegistrationToken] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [shopMode, setShopMode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const useFirebase = isFirebasePhoneAuthEnabled();

  const suggestedSlug = useMemo(() => slugPreview(shopName), [shopName]);
  const effectiveSlug = slugTouched ? shopSlug : suggestedSlug;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("step") === "shop") {
      const token = sessionStorage.getItem(REGISTER_TOKEN_KEY);
      const savedPhone = sessionStorage.getItem(REGISTER_PHONE_KEY);
      if (token) {
        setRegistrationToken(token);
        if (savedPhone) setPhone(savedPhone);
        setStep("shop");
      }
    }
  }, []);

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (useFirebase) {
        const conf = await sendFirebasePhoneOtp(phone);
        setConfirmation(conf);
        setDevOtp("");
        setStep("otp");
      } else {
        const res = await api.register.requestOtp(phone);
        setDevOtp(res.dev_otp || "");
        setConfirmation(null);
        setStep("otp");
      }
    } catch (err) {
      setError(err.message || "Could not send OTP");
      if (typeof window !== "undefined") {
        window.__zetroRecaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let res;
      if (useFirebase) {
        if (!confirmation) throw new Error("Request OTP again");
        const { idToken } = await confirmFirebaseOtp(confirmation, otp);
        res = await api.register.firebase(idToken);
      } else {
        res = await api.register.verifyOtp(phone, otp);
      }
      setRegistrationToken(res.registration_token);
      setPhone(res.phone || phone);
      sessionStorage.setItem(REGISTER_TOKEN_KEY, res.registration_token);
      sessionStorage.setItem(REGISTER_PHONE_KEY, res.phone || phone);
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

  function goToMode(e) {
    e.preventDefault();
    if (shopName.trim().length < 2) {
      setError("Enter a shop name");
      return;
    }
    setError("");
    setStep("mode");
  }

  async function createShop(e) {
    e.preventDefault();
    if (!shopMode) {
      setError("Choose how you want to run your shop");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.register.createShop(registrationToken, {
        name: shopName.trim(),
        slug: effectiveSlug || undefined,
        logo,
        shop_mode: shopMode,
      });
      sessionStorage.removeItem(REGISTER_TOKEN_KEY);
      sessionStorage.removeItem(REGISTER_PHONE_KEY);
      setTokens("shop", res.shop.slug, res);
      const dest =
        shopMode === "billing" ? `/${res.shop.slug}/admin/billing` : `/${res.shop.slug}/admin`;
      router.push(dest);
    } catch (err) {
      setError(err.message || "Could not create shop");
    } finally {
      setLoading(false);
    }
  }

  const subtitles = {
    phone: useFirebase
      ? "Start your shop — verify your mobile with Firebase OTP."
      : "Start your shop — verify your mobile number with OTP.",
    otp: `Enter the OTP sent to ${phone}.`,
    shop: "Almost done — name your shop and add a logo if you have one.",
    mode: "How will you use Zetro? Choose Billing only, Shopping cart, or Both.",
  };

  return (
    <AuthCard subtitle={subtitles[step]} wide={step === "mode"}>
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
            <Button
              variant="link"
              type="button"
              onClick={() => {
                setStep("phone");
                setConfirmation(null);
                setOtp("");
              }}
            >
              Change number
            </Button>
          </div>
        </Form>
      ) : null}

      {step === "shop" ? (
        <Form onSubmit={goToMode}>
          {phone ? (
            <Alert variant="success" className="py-2">
              Verified phone: <strong>{phone}</strong>
            </Alert>
          ) : null}
          <Form.Group className="mb-3">
            <Form.Label>Shop name</Form.Label>
            <Form.Control
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="My Shop"
              required
              minLength={2}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Store URL</Form.Label>
            <div className="input-group">
              <span className="input-group-text">/</span>
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
            <Button variant="primary" type="submit" disabled={shopName.trim().length < 2}>
              Continue
            </Button>
          </div>
        </Form>
      ) : null}

      {step === "mode" ? (
        <Form onSubmit={createShop}>
          <div className="shop-mode-grid mb-4">
            {MODE_OPTIONS.map((opt) => {
              const selected = shopMode === opt.id;
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`shop-mode-card${selected ? " is-selected" : ""}`}
                  onClick={() => setShopMode(opt.id)}
                  aria-pressed={selected}
                >
                  <span className="shop-mode-card__check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="shop-mode-card__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className="shop-mode-card__title">{opt.title}</div>
                  <p className="shop-mode-card__blurb">{opt.blurb}</p>
                  <ul className="shop-mode-card__points">
                    {opt.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="outline-secondary" type="button" onClick={() => setStep("shop")}>
              Back
            </Button>
            <Button type="submit" disabled={loading || !shopMode} className="flex-grow-1">
              {loading ? "Creating shop…" : "Create my shop"}
            </Button>
          </div>
        </Form>
      ) : null}
      <div id="firebase-recaptcha" />
    </AuthCard>
  );
}
