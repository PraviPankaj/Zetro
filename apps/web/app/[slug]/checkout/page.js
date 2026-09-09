"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "../../../lib/api";
import { money } from "../../../lib/storefront";

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
      <div className="bg0 p-t-75 p-b-85">
        <div className="container">
          <div className="bor10 p-lr-40 p-t-30 p-b-40 m-lr-auto" style={{ maxWidth: 560 }}>
            <h4 className="mtext-109 cl2 p-b-20">Order placed</h4>
            <p className="stext-102 cl6 p-b-20">
              {order.order_number} · {money(order.total)} · {order.payment_provider}
            </p>
            <Link href={`/${slug}`} className="flex-c-m stext-101 cl0 size-101 bg1 bor1 hov-btn1 p-lr-15 trans-04">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container">
        <div className="bread-crumb flex-w p-l-25 p-r-15 p-t-30 p-lr-0-lg">
          <Link href={`/${slug}`} className="stext-109 cl8 hov-cl1 trans-04">
            Home
            <i className="fa fa-angle-right m-l-9 m-r-10" aria-hidden="true" />
          </Link>
          <Link href={`/${slug}/cart`} className="stext-109 cl8 hov-cl1 trans-04">
            Cart
            <i className="fa fa-angle-right m-l-9 m-r-10" aria-hidden="true" />
          </Link>
          <span className="stext-109 cl4">Checkout</span>
        </div>
      </div>

      <form className="bg0 p-t-75 p-b-85" onSubmit={place}>
        <div className="container">
          <div className="row">
            <div className="col-lg-7 m-b-50">
              <div className="bor10 p-lr-40 p-t-30 p-b-40 p-lr-15-sm">
                <h4 className="mtext-109 cl2 p-b-30">Shipping</h4>
                {error ? <p className="stext-102 cl1 p-b-20">{error}</p> : null}
                {["name", "phone", "line1", "city", "pincode"].map((field) => (
                  <div key={field} className="bor8 m-b-20 how-pos4-parent">
                    <input
                      className="stext-111 cl2 plh3 size-116 p-l-28 p-r-30"
                      placeholder={field === "line1" ? "Address" : field.charAt(0).toUpperCase() + field.slice(1)}
                      value={address[field]}
                      onChange={(e) => setAddress({ ...address, [field]: e.target.value })}
                      required
                    />
                  </div>
                ))}
                <div className="p-t-10">
                  <span className="stext-110 cl2 p-b-10 d-block">Payment</span>
                  {(methods.length ? methods : [{ provider: "cod", label: "Cash on delivery" }]).map((m) => (
                    <label key={m.provider} className="stext-102 cl6 d-block p-b-8">
                      <input
                        type="radio"
                        name="provider"
                        className="m-r-10"
                        checked={provider === m.provider}
                        onChange={() => setProvider(m.provider)}
                      />
                      {m.label || m.provider}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-5 m-b-50">
              <div className="bor10 p-lr-40 p-t-30 p-b-40 p-lr-15-sm">
                <h4 className="mtext-109 cl2 p-b-30">Order summary</h4>
                <div className="flex-w flex-t bor12 p-b-13">
                  <div className="size-208">
                    <span className="stext-110 cl2">Subtotal</span>
                  </div>
                  <div className="size-209">
                    <span className="mtext-110 cl2">{money(subtotal)}</span>
                  </div>
                </div>
                <div className="flex-w flex-m m-t-20 m-b-20">
                  <input
                    className="stext-104 cl2 plh4 size-117 bor13 p-lr-20 m-r-10 m-tb-5"
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="flex-c-m stext-101 cl2 size-118 bg8 bor13 hov-btn3 p-lr-15 trans-04 pointer m-tb-5"
                    onClick={applyCoupon}
                  >
                    Apply
                  </button>
                </div>
                {couponPreview ? (
                  <p className="stext-102 cl1 p-b-10">
                    Coupon {couponPreview.code}: −{money(couponPreview.discount_amount)}
                  </p>
                ) : null}
                <div className="flex-w flex-t p-t-15 p-b-33">
                  <div className="size-208">
                    <span className="mtext-101 cl2">Total</span>
                  </div>
                  <div className="size-209 p-t-1">
                    <span className="mtext-110 cl2">
                      {money(
                        couponPreview?.discount_amount != null
                          ? Math.max(0, Number(subtotal) - Number(couponPreview.discount_amount))
                          : subtotal
                      )}
                    </span>
                  </div>
                </div>
                <button type="submit" className="flex-c-m stext-101 cl0 size-116 bg3 bor14 hov-btn3 p-lr-15 trans-04 pointer">
                  Place order
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
