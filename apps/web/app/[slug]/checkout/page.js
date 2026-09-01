"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "../../../lib/api";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function CheckoutPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [methods, setMethods] = useState([]);
  const [provider, setProvider] = useState("cod");
  const [address, setAddress] = useState({ name: "", phone: "", line1: "", city: "", pincode: "" });
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState(null);
  const [subtotal, setSubtotal] = useState(0);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken("customer", slug);
    if (!token) {
      router.push(`/${slug}/login`);
      return;
    }
    api
      .shop(slug)
      .paymentMethods()
      .then((list) => {
        setMethods(list);
        if (list[0]) setProvider(list[0].provider);
      });
    api
      .shop(slug)
      .cart.get(token)
      .then((cart) => setSubtotal(cart.subtotal || 0))
      .catch(() => setSubtotal(0));
  }, [slug, router]);

  async function applyCoupon() {
    setError("");
    try {
      const token = getToken("customer", slug);
      const result = await api.shop(slug).cart.validateCoupon(couponCode, subtotal, token);
      setCouponPreview(result);
    } catch (err) {
      setCouponPreview(null);
      setError(err.message);
    }
  }

  async function place(e) {
    e.preventDefault();
    setError("");
    try {
      const result = await api.shop(slug).checkout(
        {
          payment_provider: provider,
          shipping_address: address,
          coupon_code: couponPreview?.code || couponCode || undefined,
        },
        getToken("customer", slug)
      );
      setOrder(result);
    } catch (err) {
      setError(err.message);
    }
  }

  if (order) {
    return (
      <section className="sf-section">
        <h1 style={{ fontFamily: "Syne, sans-serif" }}>Order placed</h1>
        <p>
          {order.order_number} · {money(order.total)} · {order.payment_provider}
        </p>
        {order.discount_amount > 0 ? (
          <p className="text-muted">You saved {money(order.discount_amount)}</p>
        ) : null}
      </section>
    );
  }

  const total = couponPreview?.total ?? subtotal;

  return (
    <section className="sf-section">
      <form className="sf-form" onSubmit={place}>
        <h1 style={{ fontFamily: "Syne, sans-serif" }}>Checkout</h1>
        {error ? <p>{error}</p> : null}
        <label>Name</label>
        <input
          required
          value={address.name}
          onChange={(e) => setAddress({ ...address, name: e.target.value })}
        />
        <label>Phone</label>
        <input
          required
          value={address.phone}
          onChange={(e) => setAddress({ ...address, phone: e.target.value })}
        />
        <label>Address</label>
        <textarea
          required
          value={address.line1}
          onChange={(e) => setAddress({ ...address, line1: e.target.value })}
        />
        <label>City</label>
        <input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
        <label>Pincode</label>
        <input
          value={address.pincode}
          onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
        />
        <label>Coupon code</label>
        <div className="d-flex gap-2 mb-3">
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="SAVE10"
          />
          <button type="button" className="sf-btn sf-btn-secondary" onClick={applyCoupon}>
            Apply
          </button>
        </div>
        {couponPreview ? (
          <p className="text-success">
            Coupon {couponPreview.code} applied — save {money(couponPreview.discount_amount)}
          </p>
        ) : null}
        <p className="fw-semibold">Total: {money(total)}</p>
        <label>Payment</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {methods.map((m) => (
            <option key={m.provider} value={m.provider}>
              {m.provider.toUpperCase()}
            </option>
          ))}
        </select>
        <button className="sf-btn" type="submit">
          Place order
        </button>
      </form>
    </section>
  );
}
