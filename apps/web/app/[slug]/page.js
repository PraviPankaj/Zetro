"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import HeroSlider from "../../components/store/HeroSlider";
import ProductCard from "../../components/store/ProductCard";
import ProductFilterTabs from "../../components/store/ProductFilterTabs";
import CustomThemeHome from "../../components/store/CustomThemeHome";
import { COZA_ASSETS } from "../../components/store/CozaAssets";
import { api } from "../../lib/api";
import { filterProducts, topLevelCategories } from "../../lib/storefront";

const BANNER_IMAGES = [
  `${COZA_ASSETS}/images/banner-01.jpg`,
  `${COZA_ASSETS}/images/banner-02.jpg`,
  `${COZA_ASSETS}/images/banner-03.jpg`,
];

export default function ShopHome() {
  return (
    <Suspense fallback={<div className="p-t-100 p-b-100 txt-center">Loading…</div>}>
      <ShopHomeContent />
    </Suspense>
  );
}

function ShopHomeContent() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const categorySlug = searchParams.get("category") || "";
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.shop(slug).info().then(setShop);
    api.shop(slug).catalog().then(setProducts);
    api.shop(slug).categories.browse().then(setCategories);
  }, [slug]);

  const tops = useMemo(() => topLevelCategories(categories), [categories]);

  const visibleProducts = useMemo(() => {
    let list = filterProducts(products, query, { categorySlug, categories });
    if (filter !== "all") {
      list = filterProducts(list, "", { categorySlug: filter, categories });
    }
    return list;
  }, [products, query, categorySlug, categories, filter]);

  if (shop?.custom_theme_active) {
    return <CustomThemeHome />;
  }

  return (
    <>
      <HeroSlider slug={slug} shop={shop} products={products} />

      <div className="sec-banner bg0 p-t-80 p-b-50">
        <div className="container">
          <div className="row">
            {(tops.length ? tops.slice(0, 3) : [{ id: "all", name: "Shop", slug: null }]).map((cat, i) => (
              <div key={cat.id} className="col-md-6 col-xl-4 p-b-30 m-lr-auto">
                <div className="block1 wrap-pic-w">
                  <img src={BANNER_IMAGES[i % BANNER_IMAGES.length]} alt={cat.name} />
                  <Link
                    href={cat.slug ? `/${slug}/category/${cat.slug}` : `/${slug}#catalog`}
                    className="block1-txt ab-t-l s-full flex-col-l-sb p-lr-38 p-tb-34 trans-03 respon3"
                  >
                    <div className="block1-txt-child1 flex-col-l">
                      <span className="block1-name ltext-102 trans-04 p-b-8">{cat.name}</span>
                      <span className="block1-info stext-102 trans-04">{shop?.name || "Collection"}</span>
                    </div>
                    <div className="block1-txt-child2 p-b-4 trans-05">
                      <div className="block1-link stext-101 cl0 trans-09">Shop Now</div>
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="bg0 p-t-23 p-b-140" id="catalog">
        <div className="container">
          <div className="p-b-10">
            <h3 className="ltext-103 cl5">Product Overview</h3>
          </div>

          <div className="p-b-40">
            <ProductFilterTabs
              active={filter}
              onChange={setFilter}
              items={[
                { id: "all", label: "All Products" },
                ...tops.map((cat) => ({ id: cat.slug, label: cat.name })),
              ]}
            />
          </div>

          {visibleProducts.length === 0 ? (
            <p className="stext-102 cl6 txt-center p-t-40">No products match your search.</p>
          ) : (
            <div className="row">
              {visibleProducts.map((p) => (
                <ProductCard key={p.id} slug={slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
