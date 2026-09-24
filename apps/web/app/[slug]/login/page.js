"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, notifyAuthChange, setTokens } from "../../../lib/api";
import {
  confirmFirebaseOtp,
  isFirebasePhoneAuthEnabled,
  sendFirebasePhoneOtp,
} from "../../../lib/firebase";

export default function CustomerLogin() {
  const { slug } = useParams();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
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
        const res = await api.shop(slug).customerOtpRequest(phone);
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

  async function verify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (useFirebase) {
        if (!confirmation) throw new Error("Request OTP again");
        const { idToken } = await confirmFirebaseOtp(confirmation, otp);
        const tokens = await api.shop(slug).customerFirebaseLogin(idToken, name || undefined);
        setTokens("customer", slug, tokens);
      } else {
        const tokens = await api.shop(slug).customerOtpVerify(phone, otp, name);
        setTokens("customer", slug, tokens);
      }
      notifyAuthChange();
      router.push(`/${slug}`);
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="container">
        <div className="bread-crumb flex-w p-l-25 p-r-15 p-t-30 p-lr-0-lg">
          <Link href={`/${slug}`} className="stext-109 cl8 hov-cl1 trans-04">
            Home
            <i className="fa fa-angle-right m-l-9 m-r-10" aria-hidden="true" />
          </Link>
          <span className="stext-109 cl4">Login</span>
        </div>
      </div>

      <div className="bg0 p-t-75 p-b-85">
        <div className="container">
          <form
            className="bor10 p-lr-40 p-t-30 p-b-40 m-lr-auto p-lr-15-sm"
            style={{ maxWidth: 480 }}
            onSubmit={step === "phone" ? requestOtp : verify}
          >
            <h4 className="mtext-109 cl2 p-b-30">Customer login</h4>
            {useFirebase ? (
              <p className="stext-102 cl6 p-b-20">Sign in with your mobile — OTP via Firebase.</p>
            ) : (
              <p className="stext-102 cl6 p-b-20">Dev mode: OTP is shown on screen (no SMS).</p>
            )}
            {error ? <p className="stext-102 cl1 p-b-20">{error}</p> : null}
            {step === "phone" ? (
              <>
                <div className="bor8 m-b-20">
                  <input
                    className="stext-111 cl2 plh3 size-116 p-l-28 p-r-30"
                    placeholder="Mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="bor8 m-b-20">
                  <input
                    className="stext-111 cl2 plh3 size-116 p-l-28 p-r-30"
                    placeholder="Name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="flex-c-m stext-101 cl0 size-116 bg3 bor14 hov-btn3 p-lr-15 trans-04 pointer"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                {devOtp ? <p className="stext-102 cl6 p-b-20">Dev OTP: {devOtp}</p> : null}
                <div className="bor8 m-b-20">
                  <input
                    className="stext-111 cl2 plh3 size-116 p-l-28 p-r-30"
                    placeholder="OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="flex-c-m stext-101 cl0 size-116 bg3 bor14 hov-btn3 p-lr-15 trans-04 pointer"
                  disabled={loading}
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>
                <button
                  type="button"
                  className="flex-c-m stext-101 cl6 size-116 p-t-20 pointer"
                  onClick={() => {
                    setStep("phone");
                    setConfirmation(null);
                    setOtp("");
                  }}
                >
                  Change number
                </button>
              </>
            )}
            <div id="firebase-recaptcha" />
          </form>
        </div>
      </div>
    </>
  );
}
