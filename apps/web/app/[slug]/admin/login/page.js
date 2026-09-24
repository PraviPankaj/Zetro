"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Form } from "react-bootstrap";
import AuthCard from "../../../../components/admin/AuthCard";
import { api, setTokens } from "../../../../lib/api";
import {
  confirmFirebaseOtp,
  isFirebasePhoneAuthEnabled,
  sendFirebasePhoneOtp,
} from "../../../../lib/firebase";

const REGISTER_TOKEN_KEY = "zetro_registration_token";
const REGISTER_PHONE_KEY = "zetro_registration_phone";

export default function ShopAdminLogin() {
  const { slug } = useParams();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const useFirebase = isFirebasePhoneAuthEnabled();

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
        const res = await api.shop(slug).staffOtpRequest(phone);
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

  async function continueAsNewShop(idToken) {
    const reg = await api.register.firebase(idToken);
    sessionStorage.setItem(REGISTER_TOKEN_KEY, reg.registration_token);
    sessionStorage.setItem(REGISTER_PHONE_KEY, reg.phone);
    router.push("/register?step=shop");
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (useFirebase) {
        if (!confirmation) throw new Error("Request OTP again");
        const { idToken } = await confirmFirebaseOtp(confirmation, otp);
        try {
          const tokens = await api.shop(slug).staffFirebaseLogin(idToken);
          setTokens("shop", slug, tokens);
          router.push(`/${slug}/admin`);
          return;
        } catch (err) {
          // Phone verified but not staff of this shop → create a new shop instead
          if (err.status === 404) {
            await continueAsNewShop(idToken);
            return;
          }
          throw err;
        }
      }

      const tokens = await api.shop(slug).staffOtpVerify(phone, otp);
      setTokens("shop", slug, tokens);
      router.push(`/${slug}/admin`);
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      subtitle={
        useFirebase
          ? `Shop admin for /${slug} — login with phone OTP.`
          : `Shop admin for /${slug} — login with mobile OTP.`
      }
    >
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {step === "phone" ? (
        <Form onSubmit={requestOtp}>
          <Form.Group className="mb-3">
            <Form.Label>Mobile number</Form.Label>
            <Form.Control
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              required
            />
            <Form.Text muted>
              {useFirebase
                ? "Must be staff for this shop. New numbers can create their own shop after OTP."
                : "Dev mode: OTP shown after send (no SMS)."}
            </Form.Text>
          </Form.Group>
          <div className="d-grid gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </Button>
            <Button as={Link} href="/register" variant="outline-secondary">
              Create a new shop
            </Button>
          </div>
        </Form>
      ) : (
        <Form onSubmit={verify}>
          {devOtp ? <Alert variant="info">Dev OTP: {devOtp}</Alert> : null}
          <Form.Group className="mb-3">
            <Form.Label>OTP</Form.Label>
            <Form.Control value={otp} onChange={(e) => setOtp(e.target.value)} required />
          </Form.Group>
          <div className="d-grid gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Verify"}
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
      )}
      <div id="firebase-recaptcha" />
    </AuthCard>
  );
}
