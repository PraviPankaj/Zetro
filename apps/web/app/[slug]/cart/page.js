"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getToken } from "../../../lib/api";
import { money } from "../../../lib/storefront";
import { COZA_ASSETS } from "../../../components/store/CozaAssets";

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

  if (!cart) return <div className="p-t-100 p-b-100 txt-center">Loading…</div>;

  return (
    <>
      <div className="container">
        <div className="bread-crumb flex-w p-l-25 p-r-15 p-t-30 p-lr-0-lg">
          <Link href={`/${slug}`} className="stext-109 cl8 hov-cl1 trans-04">
            Home
            <i className="fa fa-angle-right m-l-9 m-r-10" aria-hidden="true" />
          </Link>
          <span className="stext-109 cl4">Shopping Cart</span>
        </div>
      </div>

      <form className="bg0 p-t-75 p-b-85">
        <div className="container">
          <div className="row">
            <div className="col-lg-10 col-xl-7 m-lr-auto m-b-50">
              <div className="m-l-25 m-r--38 m-lr-0-xl">
                {cart.items.length === 0 ? (
                  <p className="stext-102 cl6">Your cart is empty. <Link href={`/${slug}#catalog`}>Continue shopping</Link></p>
                ) : (
                  <div className="wrap-table-shopping-cart">
                    <table className="table-shopping-cart">
                      <thead>
                        <tr className="table_head">
                          <th className="column-1">Product</th>
                          <th className="column-2" />
                          <th className="column-3">Price</th>
                          <th className="column-4">Quantity</th>
                          <th className="column-5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.items.map((item) => (
                          <tr key={item.id} className="table_row">
                            <td className="column-1">
                              <div className="how-itemcart1">
                                <img
                                  src={item.image_url ? api.mediaUrl(item.image_url) : `${COZA_ASSETS}/images/item-cart-01.jpg`}
                                  alt=""
                                />
                              </div>
                            </td>
                            <td className="column-2">
                              <strong>{item.product_name}</strong>
                              <div className="stext-102 cl6">{item.variant_name}</div>
                              <button
                                type="button"
                                className="stext-102 cl1 hov-cl1 trans-04"
                                onClick={() => remove(item.id)}
                                style={{ background: "none", border: "none", padding: 0, marginTop: 8 }}
                              >
                                Remove
                              </button>
                            </td>
                            <td className="column-3">{money(item.unit_price)}</td>
                            <td className="column-4">{item.quantity}</td>
                            <td className="column-5">{money(Number(item.unit_price) * Number(item.quantity))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="col-sm-10 col-lg-7 col-xl-5 m-lr-auto m-b-50">
              <div className="bor10 p-lr-40 p-t-30 p-b-40 m-l-63 m-r-40 m-lr-0-xl p-lr-15-sm">
                <h4 className="mtext-109 cl2 p-b-30">Cart Totals</h4>
                <div className="flex-w flex-t bor12 p-b-13">
                  <div className="size-208">
                    <span className="stext-110 cl2">Subtotal:</span>
                  </div>
                  <div className="size-209">
                    <span className="mtext-110 cl2">{money(cart.subtotal)}</span>
                  </div>
                </div>
                <div className="flex-w flex-t p-t-27 p-b-33">
                  <div className="size-208">
                    <span className="mtext-101 cl2">Total:</span>
                  </div>
                  <div className="size-209 p-t-1">
                    <span className="mtext-110 cl2">{money(cart.subtotal)}</span>
                  </div>
                </div>
                {cart.items.length ? (
                  <Link
                    href={`/${slug}/checkout`}
                    className="flex-c-m stext-101 cl0 size-116 bg3 bor14 hov-btn3 p-lr-15 trans-04 pointer"
                  >
                    Proceed to Checkout
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
