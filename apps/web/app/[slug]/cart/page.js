"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "../../../lib/api";

export default function CartPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [cart, setCart] = useState(null);

  function load() {
    const token = getToken("customer", slug);
    if (!token) {
      router.push(`/${slug}/login`);
      return;
    }
    api.shop(slug).cart.get(token).then(setCart);
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function remove(id) {
    await api.shop(slug).cart.remove(id, getToken("customer", slug));
    load();
  }

  if (!cart) return <div className="sf-section">Loading…</div>;

  return (
    <section className="sf-section">
      <h1 style={{ fontFamily: "Syne, sans-serif" }}>Cart</h1>
      {cart.items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div>
          {cart.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr auto auto",
                gap: 16,
                alignItems: "center",
                padding: "1rem 0",
                borderBottom: "1px solid #c5d5dc",
              }}
            >
              {item.image_url ? (
                <img src={item.image_url} alt="" style={{ width: 80, height: 80, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 80, height: 80, background: "#c5d5dc" }} />
              )}
              <div>
                <strong>{item.product_name}</strong>
                <div>{item.variant_name}</div>
              </div>
              <div>
                {item.quantity} × ₹{item.unit_price}
              </div>
              <button type="button" onClick={() => remove(item.id)}>
                Remove
              </button>
            </div>
          ))}
          <p style={{ marginTop: 24, fontWeight: 700 }}>Subtotal ₹{cart.subtotal}</p>
          <Link className="sf-btn" href={`/${slug}/checkout`}>
            Checkout
          </Link>
        </div>
      )}
    </section>
  );
}
