import Link from "next/link";

export default function HomePage() {
  return (
    <div id="storefront">
      <header className="sf-header">
        <div className="sf-header-inner">
          <span className="sf-logo">Zetro</span>
          <nav className="sf-nav">
            <Link href="/abc">Demo shop</Link>
            <Link href="/register">Start your shop</Link>
            <Link href="/platform/login">Platform</Link>
          </nav>
        </div>
      </header>
      <section className="sf-hero">
        <div className="sf-hero-copy">
          <h1>Zetro</h1>
          <p>A network of independent shops. Each storefront, stock, and checkout lives on its own path.</p>
          <p className="mt-4 d-flex flex-wrap gap-3">
            <Link href="/abc" className="btn btn-outline-primary btn-lg">
              Browse ABC Kids demo
            </Link>
            <Link href="/abc/admin/login" className="btn btn-success btn-lg">
              ABC admin (no OTP)
            </Link>
            <Link href="/register" className="btn btn-primary btn-lg">
              Start your shop
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
