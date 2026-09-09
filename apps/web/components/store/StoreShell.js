"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, getToken, notifyAuthChange } from "../../lib/api";
import { topLevelCategories } from "../../lib/storefront";
import CozaAssets, { COZA_ASSETS } from "./CozaAssets";

function StoreHeader({ slug, shop, categories }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);
  const [customer, setCustomer] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isHome = pathname === `/${slug}` || pathname === `/${slug}/`;

  const loadAuth = useCallback(() => {
    const token = getToken("customer", slug);
    if (!token) {
      setCustomer(null);
      setCartCount(0);
      return;
    }
    api
      .shop(slug)
      .customerMe(token)
      .then(setCustomer)
      .catch(() => {
        clearToken("customer", slug);
        setCustomer(null);
      });
    api
      .shop(slug)
      .cart.get(token)
      .then((c) => setCartCount(c.items?.length || 0))
      .catch(() => setCartCount(0));
  }, [slug]);

  useEffect(() => {
    loadAuth();
    window.addEventListener("zetro-auth", loadAuth);
    window.addEventListener("focus", loadAuth);
    return () => {
      window.removeEventListener("zetro-auth", loadAuth);
      window.removeEventListener("focus", loadAuth);
    };
  }, [loadAuth]);

  function logout() {
    clearToken("customer", slug);
    setCustomer(null);
    setCartCount(0);
    notifyAuthChange();
  }

  function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    setSearchOpen(false);
    if (q) router.push(`/${slug}/search?q=${encodeURIComponent(q)}`);
  }

  const logoSrc = shop?.logo_url
    ? api.mediaUrl(shop.logo_url)
    : `${COZA_ASSETS}/images/icons/logo-01.png`;
  const tops = topLevelCategories(categories).slice(0, 6);
  const navActive = (href) => (pathname === href || pathname?.startsWith(`${href}/`) ? "active-menu" : "");

  return (
    <header className={isHome ? "" : "header-v4"}>
      <div className="container-menu-desktop">
        <div className="top-bar">
          <div className="content-topbar flex-sb-m h-full container">
            <div className="left-top-bar">{shop?.description || "Free shipping on selected orders"}</div>
            <div className="right-top-bar flex-w h-full">
              {customer ? (
                <>
                  <span className="flex-c-m trans-04 p-lr-25">Hi, {customer.name || customer.phone}</span>
                  <button type="button" className="flex-c-m trans-04 p-lr-25" onClick={logout} style={{ background: "none", border: "none", color: "inherit" }}>
                    Logout
                  </button>
                </>
              ) : (
                <Link href={`/${slug}/login`} className="flex-c-m trans-04 p-lr-25">
                  My Account
                </Link>
              )}
              <Link href={`/${slug}/admin/login`} className="flex-c-m trans-04 p-lr-25">
                Shop admin
              </Link>
            </div>
          </div>
        </div>

        <div className={`wrap-menu-desktop fix-menu-desktop${isHome ? "" : " how-shadow1"}`}>
          <nav className="limiter-menu-desktop container">
            <Link href={`/${slug}`} className="logo">
              <img src={logoSrc} alt={shop?.name || slug} style={{ maxHeight: 27 }} />
            </Link>

            <div className="menu-desktop">
              <ul className="main-menu">
                <li className={navActive(`/${slug}`) || (isHome ? "active-menu" : "")}>
                  <Link href={`/${slug}`}>Home</Link>
                </li>
                <li className={pathname?.includes("/search") || pathname?.includes("/category") ? "active-menu" : ""}>
                  <Link href={`/${slug}#catalog`}>Shop</Link>
                </li>
                {tops.map((cat) => (
                  <li key={cat.id} className={navActive(`/${slug}/category/${cat.slug}`)}>
                    <Link href={`/${slug}/category/${cat.slug}`}>{cat.name}</Link>
                  </li>
                ))}
                <li className={navActive(`/${slug}/cart`)}>
                  <Link href={`/${slug}/cart`}>Cart</Link>
                </li>
              </ul>
            </div>

            <div className="wrap-icon-header flex-w flex-r-m">
              <button
                type="button"
                className="icon-header-item cl2 hov-cl1 trans-04 p-l-22 p-r-11"
                onClick={() => setSearchOpen(true)}
                style={{ background: "none", border: "none" }}
                aria-label="Search"
              >
                <i className="zmdi zmdi-search" />
              </button>
              <Link
                href={`/${slug}/cart`}
                className="icon-header-item cl2 hov-cl1 trans-04 p-l-22 p-r-11 icon-header-noti"
                data-notify={String(cartCount)}
              >
                <i className="zmdi zmdi-shopping-cart" />
              </Link>
            </div>
          </nav>
        </div>
      </div>

      <div className="wrap-header-mobile">
        <div className="logo-mobile">
          <Link href={`/${slug}`}>
            <img src={logoSrc} alt={shop?.name || slug} />
          </Link>
        </div>
        <div className="wrap-icon-header flex-w flex-r-m m-r-15">
          <button
            type="button"
            className="icon-header-item cl2 hov-cl1 trans-04 p-r-11"
            onClick={() => setSearchOpen(true)}
            style={{ background: "none", border: "none" }}
            aria-label="Search"
          >
            <i className="zmdi zmdi-search" />
          </button>
          <Link
            href={`/${slug}/cart`}
            className="icon-header-item cl2 hov-cl1 trans-04 p-r-11 p-l-10 icon-header-noti"
            data-notify={String(cartCount)}
          >
            <i className="zmdi zmdi-shopping-cart" />
          </Link>
        </div>
        <button
          type="button"
          className={`btn-show-menu-mobile hamburger hamburger--squeeze${mobileOpen ? " is-active" : ""}`}
          onClick={() => setMobileOpen((v) => !v)}
          style={{ background: "none", border: "none" }}
          aria-label="Menu"
        >
          <span className="hamburger-box">
            <span className="hamburger-inner" />
          </span>
        </button>
      </div>

      <div className="menu-mobile" style={{ display: mobileOpen ? "block" : "none" }}>
        <ul className="main-menu-m">
          <li>
            <Link href={`/${slug}`} onClick={() => setMobileOpen(false)}>
              Home
            </Link>
          </li>
          <li>
            <Link href={`/${slug}#catalog`} onClick={() => setMobileOpen(false)}>
              Shop
            </Link>
          </li>
          {tops.map((cat) => (
            <li key={cat.id}>
              <Link href={`/${slug}/category/${cat.slug}`} onClick={() => setMobileOpen(false)}>
                {cat.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href={`/${slug}/cart`} onClick={() => setMobileOpen(false)}>
              Cart
            </Link>
          </li>
          <li>
            <Link href={customer ? `/${slug}` : `/${slug}/login`} onClick={() => setMobileOpen(false)}>
              {customer ? "Account" : "Login"}
            </Link>
          </li>
        </ul>
      </div>

      <div
        className={`modal-search-header flex-c-m trans-04${searchOpen ? " show-modal-search" : ""}`}
        style={{ display: searchOpen ? "flex" : "none" }}
        onClick={() => setSearchOpen(false)}
      >
        <div className="container-search-header" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex-c-m btn-hide-modal-search trans-04"
            onClick={() => setSearchOpen(false)}
            style={{ background: "none", border: "none" }}
          >
            <img src={`${COZA_ASSETS}/images/icons/icon-close2.png`} alt="CLOSE" />
          </button>
          <form className="wrap-search-header flex-w p-l-15" onSubmit={onSearch}>
            <button type="submit" className="flex-c-m trans-04" style={{ background: "none", border: "none" }}>
              <i className="zmdi zmdi-search" />
            </button>
            <input
              className="plh3"
              type="text"
              name="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
        </div>
      </div>
    </header>
  );
}

function StoreFooter({ slug, shop, categories }) {
  const tops = topLevelCategories(categories).slice(0, 4);
  return (
    <footer className="bg3 p-t-75 p-b-32">
      <div className="container">
        <div className="row">
          <div className="col-sm-6 col-lg-3 p-b-50">
            <h4 className="stext-301 cl0 p-b-30">Categories</h4>
            <ul>
              {tops.length ? (
                tops.map((cat) => (
                  <li key={cat.id} className="p-b-10">
                    <Link href={`/${slug}/category/${cat.slug}`} className="stext-107 cl7 hov-cl1 trans-04">
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="p-b-10">
                  <Link href={`/${slug}#catalog`} className="stext-107 cl7 hov-cl1 trans-04">
                    Shop all
                  </Link>
                </li>
              )}
            </ul>
          </div>
          <div className="col-sm-6 col-lg-3 p-b-50">
            <h4 className="stext-301 cl0 p-b-30">Help</h4>
            <ul>
              <li className="p-b-10">
                <Link href={`/${slug}/cart`} className="stext-107 cl7 hov-cl1 trans-04">
                  Cart
                </Link>
              </li>
              <li className="p-b-10">
                <Link href={`/${slug}/login`} className="stext-107 cl7 hov-cl1 trans-04">
                  Login
                </Link>
              </li>
              <li className="p-b-10">
                <Link href={`/${slug}/admin/login`} className="stext-107 cl7 hov-cl1 trans-04">
                  Shop admin
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-sm-6 col-lg-3 p-b-50">
            <h4 className="stext-301 cl0 p-b-30">GET IN TOUCH</h4>
            <p className="stext-107 cl7 size-201">
              {shop?.name || "Zetro shop"}
              {shop?.owner_phone ? ` · ${shop.owner_phone}` : ""}
              {shop?.description ? ` — ${shop.description}` : ""}
            </p>
          </div>
          <div className="col-sm-6 col-lg-3 p-b-50">
            <h4 className="stext-301 cl0 p-b-30">{shop?.name || "Zetro"}</h4>
            <p className="stext-107 cl7">Powered by Zetro · CozaStore theme</p>
          </div>
        </div>
        <div className="p-t-40">
          <p className="stext-107 cl6 txt-center">Copyright &copy; {new Date().getFullYear()} {shop?.name || "Zetro"}</p>
        </div>
      </div>
    </footer>
  );
}

export default function StoreShell({ slug, children }) {
  const [shop, setShop] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.shop(slug).info().then(setShop).catch(() => setShop(null));
    api.shop(slug).categories.browse().then(setCategories).catch(() => setCategories([]));
  }, [slug]);

  useEffect(() => {
    if (!shop) return;
    document.title = shop.meta_title || shop.name || slug;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = shop.meta_description || shop.description || "";
  }, [shop, slug]);

  return (
    <div id="storefront" className="coza-root">
      <CozaAssets />
      <Suspense fallback={null}>
        <StoreHeader slug={slug} shop={shop} categories={categories} />
      </Suspense>
      <main>{children}</main>
      <StoreFooter slug={slug} shop={shop} categories={categories} />
    </div>
  );
}
