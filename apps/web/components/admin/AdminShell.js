"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu } from "react-feather";
import { clearToken } from "../../lib/api";

export default function AdminShell({ title, basePath, items, onLogout, children, brand = "Zetro" }) {
  const [showMenu, setShowMenu] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    onLogout?.();
    router.push(basePath.includes("/admin") ? `${basePath}/login` : "/platform/login");
  }

  return (
    <div id="db-wrapper" className={showMenu ? "" : "toggled"}>
      <div className="navbar-vertical navbar">
        <div className="nav-scroller">
          <Link href={basePath} className="navbar-brand">
            <span className="brand-mark">Z</span>
            <span>{brand}</span>
          </Link>
          <ul className="navbar-nav flex-column">
            {items.map((item) => (
              <li className="nav-item" key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link ${pathname === item.href ? "active" : ""}`}
                >
                  {item.icon ? <i className={`nav-icon fe fe-${item.icon} me-2`} /> : null}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div id="page-content">
        <div className="header">
          <nav className="navbar-classic navbar navbar-expand-lg">
            <div className="d-flex justify-content-between w-100 align-items-center px-4 py-2">
              <button
                type="button"
                className="btn btn-link text-secondary p-0"
                onClick={() => setShowMenu((v) => !v)}
              >
                <Menu size={18} />
              </button>
              <div className="d-flex align-items-center gap-3">
                <span className="text-muted small">{title}</span>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={logout}>
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        </div>
        <div className="container-fluid p-6">{children}</div>
      </div>
    </div>
  );
}
