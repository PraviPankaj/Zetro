"""Seed kids-store products and images for the demo ABC shop."""

from __future__ import annotations

import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models import Category, Product, ProductImage, ProductVariant, Shop  # noqa: E402
from app.services.categories import assign_product_categories  # noqa: E402

UPLOAD_ROOT = ROOT / "backend" / "uploads" / "abc"

KIDS_CATEGORIES = [
    {"name": "Kids Clothing", "slug": "kids-clothing", "parent": None},
    {"name": "Kids Pants", "slug": "kids-pants", "parent": "kids-clothing"},
    {"name": "Kids Tops & Tees", "slug": "kids-tops", "parent": "kids-clothing"},
    {"name": "Kids Dresses", "slug": "kids-dresses", "parent": "kids-clothing"},
    {"name": "Kids Sleepwear", "slug": "kids-sleepwear", "parent": "kids-clothing"},
    {"name": "Kids Outerwear", "slug": "kids-outerwear", "parent": "kids-clothing"},
    {"name": "Kids Footwear", "slug": "kids-footwear", "parent": None},
    {"name": "Kids Toys", "slug": "kids-toys", "parent": None},
    {"name": "Kids Accessories", "slug": "kids-accessories", "parent": None},
    {"name": "School & Bags", "slug": "school-bags", "parent": None},
    {"name": "Baby Essentials", "slug": "baby-essentials", "parent": None},
]

PRODUCT_CATEGORIES = {
    "rainbow-romper": ["kids-clothing", "baby-essentials"],
    "dino-adventure-tee": ["kids-clothing", "kids-tops"],
    "cloud-night-light": ["baby-essentials"],
    "huggy-plush-bunny": ["kids-toys", "baby-essentials"],
    "pastel-play-sneakers": ["kids-footwear"],
    "wooden-block-castle": ["kids-toys"],
    "rocket-backpack": ["school-bags", "kids-accessories"],
    "sparkle-party-dress": ["kids-clothing", "kids-dresses"],
    "space-pajamas": ["kids-clothing", "kids-sleepwear"],
    "art-craft-kit": ["kids-toys"],
    "sunny-rain-jacket": ["kids-clothing", "kids-outerwear"],
    "unicorn-lunch-box": ["school-bags", "kids-accessories"],
    "adventure-baseball-cap": ["kids-accessories"],
    "cozy-onesie-bundle": ["kids-clothing", "baby-essentials"],
    "mini-balance-scooter": ["kids-toys"],
    "cool-kids-sunglasses": ["kids-accessories"],
    "bedtime-storybook-set": ["kids-toys", "baby-essentials"],
    "bubble-bath-ducks": ["kids-toys", "baby-essentials"],
    "sports-water-bottle": ["school-bags", "kids-accessories"],
    "comfy-jogger-pants": ["kids-clothing", "kids-pants"],
}

KIDS_PRODUCTS = [
    {
        "name": "Rainbow Cotton Romper",
        "slug": "rainbow-romper",
        "description": "Soft organic cotton romper in cheerful rainbow stripes. Snaps at the shoulder for easy changes.",
        "price": 890,
        "compare_at": 1190,
        "stock": 28,
        "images": [
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Dino Adventure Tee",
        "slug": "dino-adventure-tee",
        "description": "Breathable jersey tee with a friendly T-Rex print. Sizes for ages 3–8.",
        "price": 649,
        "compare_at": 799,
        "stock": 42,
        "images": [
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Cloud Night Light",
        "slug": "cloud-night-light",
        "description": "Gentle silicone cloud lamp with warm dimmable glow. Perfect for bedtime routines.",
        "price": 1290,
        "compare_at": None,
        "stock": 22,
        "images": [
            "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Huggy Plush Bunny",
        "slug": "huggy-plush-bunny",
        "description": "Ultra-soft plush bunny in oatmeal fleece. Machine washable and toddler-safe.",
        "price": 990,
        "compare_at": 1290,
        "stock": 35,
        "images": [
            "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Pastel Play Sneakers",
        "slug": "pastel-play-sneakers",
        "description": "Lightweight velcro sneakers with cushioned soles. Easy on, easy off for little feet.",
        "price": 1590,
        "compare_at": 1890,
        "stock": 24,
        "images": [
            "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Wooden Block Castle Set",
        "slug": "wooden-block-castle",
        "description": "48-piece natural wood blocks for stacking, sorting, and imaginative play.",
        "price": 1890,
        "compare_at": 2290,
        "stock": 18,
        "images": [
            "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Rocket School Backpack",
        "slug": "rocket-backpack",
        "description": "Water-resistant backpack with padded straps and a rocket patch. Fits lunch box and books.",
        "price": 1490,
        "compare_at": None,
        "stock": 30,
        "images": [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Sparkle Party Dress",
        "slug": "sparkle-party-dress",
        "description": "Twirl-ready tulle dress with a soft cotton lining. For birthdays, photos, and big days.",
        "price": 2190,
        "compare_at": 2690,
        "stock": 16,
        "images": [
            "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Space Explorer Pajamas",
        "slug": "space-pajamas",
        "description": "Cozy two-piece PJs with glow-in-the-dark stars. 100% cotton for all-night comfort.",
        "price": 1090,
        "compare_at": 1390,
        "stock": 26,
        "images": [
            "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Art & Craft Supply Kit",
        "slug": "art-craft-kit",
        "description": "Crayons, stickers, safety scissors, and drawing pad in a carry case. Rainy-day hero.",
        "price": 790,
        "compare_at": 990,
        "stock": 40,
        "images": [
            "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Sunny Rain Jacket",
        "slug": "sunny-rain-jacket",
        "description": "Waterproof hooded jacket in sunshine yellow. Reflective strips for rainy school runs.",
        "price": 1790,
        "compare_at": 2190,
        "stock": 20,
        "images": [
            "https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Unicorn Lunch Box",
        "slug": "unicorn-lunch-box",
        "description": "BPA-free lunch box with insulated lining and a sparkly unicorn print kids love.",
        "price": 690,
        "compare_at": 890,
        "stock": 38,
        "images": [
            "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Adventure Baseball Cap",
        "slug": "adventure-baseball-cap",
        "description": "Adjustable cotton cap with embroidered rocket ship. UPF 50 sun protection.",
        "price": 490,
        "compare_at": None,
        "stock": 45,
        "images": [
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Cozy Onesie Bundle",
        "slug": "cozy-onesie-bundle",
        "description": "Pack of three soft cotton onesies in pastel tones. Envelope neck for easy dressing.",
        "price": 1190,
        "compare_at": 1490,
        "stock": 32,
        "images": [
            "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Mini Balance Scooter",
        "slug": "mini-balance-scooter",
        "description": "Lightweight three-wheel scooter with adjustable handlebar. Ages 3+ with parental supervision.",
        "price": 3490,
        "compare_at": 3990,
        "stock": 12,
        "images": [
            "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Cool Kids Sunglasses",
        "slug": "cool-kids-sunglasses",
        "description": "Flexible TR90 frames with UV400 lenses. Includes a soft carry pouch.",
        "price": 590,
        "compare_at": 790,
        "stock": 50,
        "images": [
            "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Bedtime Storybook Set",
        "slug": "bedtime-storybook-set",
        "description": "Set of five illustrated storybooks with gentle themes for ages 2–6.",
        "price": 890,
        "compare_at": 1090,
        "stock": 28,
        "images": [
            "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Bubble Bath Duck Family",
        "slug": "bubble-bath-ducks",
        "description": "Set of four rubber duck characters for tub time fun. Non-toxic and mould-resistant.",
        "price": 390,
        "compare_at": None,
        "stock": 60,
        "images": [
            "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Sports Water Bottle",
        "slug": "sports-water-bottle",
        "description": "Leak-proof 500ml bottle with flip straw lid. Fits standard backpack pockets.",
        "price": 450,
        "compare_at": 550,
        "stock": 55,
        "images": [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1200&q=80",
        ],
    },
    {
        "name": "Comfy Cotton Jogger Pants",
        "slug": "comfy-jogger-pants",
        "description": "Stretchy cotton joggers with soft rib cuffs. Easy pull-on waist for active kids.",
        "price": 799,
        "compare_at": 999,
        "stock": 34,
        "images": [
            "https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80",
        ],
    },
]

KIDS_SLUGS = {p["slug"] for p in KIDS_PRODUCTS}


def download(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "ZetroSeed/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp, open(dest, "wb") as out:
            out.write(resp.read())
        return dest.stat().st_size > 1000
    except Exception as exc:  # noqa: BLE001
        print(f"  skip {dest.name}: {exc}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        return False


def clear_product_images(db, shop_id: int, product_id: int) -> None:
    for image in db.scalars(
        select(ProductImage).where(
            ProductImage.shop_id == shop_id, ProductImage.product_id == product_id
        )
    ):
        db.delete(image)


def attach_images(db, shop: Shop, product: Product, item: dict) -> None:
    clear_product_images(db, shop.id, product.id)
    for idx, image_url in enumerate(item["images"]):
        filename = f"{item['slug']}-{idx + 1}.jpg"
        dest = UPLOAD_ROOT / filename
        print(f"Downloading {filename}…")
        if not download(image_url, dest):
            continue
        db.add(
            ProductImage(
                shop_id=shop.id,
                product_id=product.id,
                url=f"/media/abc/{filename}",
                sort_order=idx,
                alt_text=item["name"],
            )
        )


def seed_categories(db, shop: Shop) -> dict[str, Category]:
    by_slug: dict[str, Category] = {}
    for item in KIDS_CATEGORIES:
        cat = db.scalar(
            select(Category).where(Category.shop_id == shop.id, Category.slug == item["slug"])
        )
        if not cat:
            cat = Category(shop_id=shop.id, name=item["name"], slug=item["slug"])
            db.add(cat)
        else:
            cat.name = item["name"]
            cat.is_active = True
        by_slug[item["slug"]] = cat
    db.flush()
    for item in KIDS_CATEGORIES:
        parent_slug = item["parent"]
        by_slug[item["slug"]].parent_id = by_slug[parent_slug].id if parent_slug else None
    db.flush()
    return by_slug


def attach_product_categories(db, shop: Shop, product: Product, category_map: dict[str, Category]) -> None:
    slugs = PRODUCT_CATEGORIES.get(product.slug, [])
    ids = [category_map[s].id for s in slugs if s in category_map]
    assign_product_categories(db, shop.id, product, ids)


def main() -> None:
    if UPLOAD_ROOT.exists():
        shutil.rmtree(UPLOAD_ROOT)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        shop = db.scalar(select(Shop).where(Shop.slug == "abc"))
        if not shop:
            raise SystemExit("Shop abc not found. Start the API once to seed the shop.")

        shop.name = "ABC Kids"
        shop.description = (
            "Clothes, toys, and little treasures for growing explorers — "
            "soft fabrics, bright colours, and smiles guaranteed."
        )

        category_map = seed_categories(db, shop)

        for old in db.scalars(select(Product).where(Product.shop_id == shop.id)):
            old.is_active = old.slug in KIDS_SLUGS

        for item in KIDS_PRODUCTS:
            product = db.scalar(
                select(Product).where(Product.shop_id == shop.id, Product.slug == item["slug"])
            )
            if not product:
                product = Product(
                    shop_id=shop.id,
                    name=item["name"],
                    slug=item["slug"],
                    description=item["description"],
                    is_active=True,
                )
                db.add(product)
                db.flush()
                db.add(
                    ProductVariant(
                        shop_id=shop.id,
                        product_id=product.id,
                        sku=f"{item['slug']}-01",
                        name="Kids",
                        price=item["price"],
                        compare_at_price=item["compare_at"],
                        stock=item["stock"],
                    )
                )
            else:
                product.name = item["name"]
                product.description = item["description"]
                product.is_active = True
                variant = db.scalar(
                    select(ProductVariant).where(
                        ProductVariant.product_id == product.id,
                        ProductVariant.shop_id == shop.id,
                    )
                )
                if variant:
                    variant.price = item["price"]
                    variant.compare_at_price = item["compare_at"]
                    variant.stock = item["stock"]
                else:
                    db.add(
                        ProductVariant(
                            shop_id=shop.id,
                            product_id=product.id,
                            sku=f"{item['slug']}-01",
                            name="Kids",
                            price=item["price"],
                            compare_at_price=item["compare_at"],
                            stock=item["stock"],
                        )
                    )

            db.flush()
            attach_images(db, shop, product, item)
            attach_product_categories(db, shop, product, category_map)

        db.commit()
        active = db.scalars(
            select(Product).where(Product.shop_id == shop.id, Product.is_active.is_(True))
        ).all()
        print(f"Seeded {len(active)} kids products for /abc")
    finally:
        db.close()


if __name__ == "__main__":
    main()
