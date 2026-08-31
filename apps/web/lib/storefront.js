export function categoryDescendantSlugs(categories, rootSlug) {
  const byParent = new Map();
  for (const cat of categories || []) {
    const key = cat.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(cat);
  }
  const root = (categories || []).find((c) => c.slug === rootSlug);
  if (!root) return new Set();

  const slugs = new Set([root.slug]);
  function walk(parentId) {
    for (const child of byParent.get(parentId) || []) {
      slugs.add(child.slug);
      walk(child.id);
    }
  }
  walk(root.id);
  return slugs;
}

export function productInCategory(product, categorySlug, categories) {
  if (!categorySlug) return true;
  const allowed = categoryDescendantSlugs(categories, categorySlug);
  return (product.categories || []).some((c) => allowed.has(c.slug));
}

export function filterProducts(products, query, { categorySlug, categories } = {}) {
  const q = (query || "").trim().toLowerCase();
  let list = products || [];

  if (categorySlug) {
    list = list.filter((p) => productInCategory(p, categorySlug, categories));
  }

  if (!q) return list;

  return list.filter((p) => {
    const categoryText = (p.categories || [])
      .flatMap((c) => [c.name, c.slug.replace(/-/g, " ")])
      .join(" ");
    const haystack = [
      p.name,
      p.slug,
      p.description,
      categoryText,
      ...(p.variants || []).map((v) => v.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (haystack.includes(q)) return true;
    const words = q.split(/\s+/).filter(Boolean);
    return words.length > 1 && words.every((word) => haystack.includes(word));
  });
}

export function topLevelCategories(categories) {
  return (categories || []).filter((c) => !c.parent_id);
}

export function childCategories(categories, parentId) {
  return (categories || []).filter((c) => c.parent_id === parentId);
}

export function findCategory(categories, slug) {
  return (categories || []).find((c) => c.slug === slug);
}

export function money(value) {
  if (value == null) return "";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}
