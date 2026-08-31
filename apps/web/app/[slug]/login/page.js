"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, notifyAuthChange, setTokens } from "../../../lib/api";

export default function CustomerLogin() {
  const { slug } = useParams();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [error, setError] = useState("");

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.shop(slug).customerOtpRequest(phone);
      setDevOtp(res.dev_otp || "");
      setStep("otp");
    } catch (err) {
      setError(err.message);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    try {
      const tokens = await api.shop(slug).customerOtpVerify(phone, otp, name);
      setTokens("customer", slug, tokens);
      notifyAuthChange();
      router.push(`/${slug}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="sf-section">
      <form className="sf-form" onSubmit={step === "phone" ? requestOtp : verify}>
        <h1 style={{ fontFamily: "Syne, sans-serif" }}>Customer login</h1>
        {error ? <p>{error}</p> : null}
        {step === "phone" ? (
          <>
            <label>Mobile</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <label>Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <button className="sf-btn" type="submit">
              Send OTP
            </button>
          </>
        ) : (
          <>
            {devOtp ? <p>Dev OTP: {devOtp}</p> : null}
            <label>OTP</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} required />
            <button className="sf-btn" type="submit">
              Verify
            </button>
          </>
        )}
      </form>
    </section>
  );
}
