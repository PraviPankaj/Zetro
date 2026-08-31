"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StoreSearch({ slug }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  function onSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/${slug}/search?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/${slug}`);
    }
  }

  return (
    <form className="sf-search" onSubmit={onSubmit} role="search">
      <input
        type="search"
        className="sf-search-input"
        placeholder="Search toys, clothes, gifts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search products"
      />
      <button type="submit" className="sf-search-btn" aria-label="Search">
        Search
      </button>
    </form>
  );
}
