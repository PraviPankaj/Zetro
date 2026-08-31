"use client";

import Link from "next/link";
import { childCategories, topLevelCategories } from "../../lib/storefront";

export default function CategoryNav({ slug, categories, activeSlug }) {
  const roots = topLevelCategories(categories);

  if (!roots.length) return null;

  return (
    <nav className="sf-category-nav" aria-label="Shop categories">
      <Link
        href={`/${slug}`}
        className={`sf-category-chip${!activeSlug ? " is-active" : ""}`}
      >
        All
      </Link>
      {roots.map((cat) => {
        const children = childCategories(categories, cat.id);
        return (
          <div key={cat.id} className="sf-category-group">
            <Link
              href={`/${slug}/category/${cat.slug}`}
              className={`sf-category-chip${activeSlug === cat.slug ? " is-active" : ""}`}
            >
              {cat.name}
            </Link>
            {children.length ? (
              <div className="sf-category-children">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/${slug}/category/${child.slug}`}
                    className={`sf-category-chip sf-category-chip-sm${
                      activeSlug === child.slug ? " is-active" : ""
                    }`}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
