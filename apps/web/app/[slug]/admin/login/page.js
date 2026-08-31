"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Form } from "react-bootstrap";
import AuthCard from "../../../../components/admin/AuthCard";
import { api, setTokens } from "../../../../lib/api";

export default function ShopAdminLogin() {
  const { slug } = useParams();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isDemoShop = slug === "abc";

  async function demoLogin() {
    setError("");
    setLoading(true);
    try {
      const tokens = await api.shop(slug).staffDemoLogin();
      setTokens("shop", slug, tokens);
      router.push(`/${slug}/admin`);
    } catch (err) {
      setError(err.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.shop(slug).staffOtpRequest(phone);
      setDevOtp(res.dev_otp || "");
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await api.shop(slug).staffOtpVerify(phone, otp);
      setTokens("shop", slug, tokens);
      router.push(`/${slug}/admin`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard subtitle={`Shop admin for /${slug} — login with mobile OTP.`}>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {isDemoShop ? (
        <div className="mb-4">
          <Alert variant="success" className="mb-3">
            Demo shop — skip OTP and enter admin directly.
          </Alert>
          <div className="d-grid">
            <Button variant="success" onClick={demoLogin} disabled={loading}>
              {loading ? "Signing in…" : "Enter ABC Kids admin (demo)"}
            </Button>
          </div>
          <hr />
        </div>
      ) : null}
      {step === "phone" ? (
        <Form onSubmit={requestOtp}>
          <Form.Group className="mb-3">
            <Form.Label>Mobile number</Form.Label>
            <Form.Control value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Form.Group>
          <div className="d-grid">
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
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
            <Button variant="link" type="button" onClick={() => setStep("phone")}>
              Change number
            </Button>
          </div>
        </Form>
      )}
    </AuthCard>
  );
}
