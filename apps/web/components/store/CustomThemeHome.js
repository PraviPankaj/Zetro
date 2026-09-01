"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";

export default function CustomThemeHome() {
  const { slug } = useParams();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .shop(slug)
      .theme.render()
      .then((res) => setHtml(res.html || ""))
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <section className="sf-section">
        <p className="text-danger">Could not load custom theme: {error}</p>
      </section>
    );
  }

  if (!html) {
    return <section className="sf-section">Loading theme…</section>;
  }

  return (
    <div
      className="custom-theme-home"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
