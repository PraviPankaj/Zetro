from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
IMG_RE = re.compile(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>', re.I)
H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.I | re.S)

STANDARD_AUTO_VARIABLES: list[dict[str, Any]] = [
    {
        "key": "shop_name",
        "type": "text",
        "label": "Shop name",
        "auto": True,
        "required": False,
        "description": "Filled from your shop profile",
    },
    {
        "key": "shop_logo",
        "type": "image",
        "label": "Shop logo",
        "auto": True,
        "required": False,
        "description": "Uses logo from shop settings",
    },
    {
        "key": "shop_description",
        "type": "textarea",
        "label": "Shop description",
        "auto": True,
        "required": False,
        "description": "Filled from your shop profile",
    },
    {
        "key": "products_catalog",
        "type": "text",
        "label": "Product catalog",
        "auto": True,
        "required": False,
        "description": "Your products, names, images and prices appear here automatically",
    },
]

SYSTEM_PROMPT = """You analyze HTML storefront theme templates for a multi-shop e-commerce platform (Zetro).

Each shop picks this template and must replace DEMO content with THEIR OWN:
- Shop name and description
- Shop logo
- Hero/banner images and headlines
- Carousel/slider images
- Product listing area (product names, images, prices come from their catalog)

The uploaded HTML may have NO {{placeholders}} yet — only hardcoded demo text and image URLs. You must:

1. Inspect the HTML structure (header logo, hero, carousels, product grids, footers, CTAs).
2. List every slot each shop must customize.
3. Return patched_html: the full HTML with {{variable_key}} inserted, replacing demo URLs/text in the right places.

ALWAYS include these auto-filled variables (mark "auto": true — shops do not upload these manually):
- shop_name — replace demo store/brand name text
- shop_logo — replace header/logo <img src>
- shop_description — replace tagline/about text if present
- products_catalog — replace the product grid/list section (or insert {{products_catalog}} where products should render)

For carousels/sliders, use type "carousel" with count = number of slides detected.
For images, include width/height from CSS or attributes when possible.
For text headlines, use type "text" or "textarea".

Return JSON only:
{
  "variables": [
    {"key": "logo", "type": "image", "label": "Header logo", "width": 180, "height": 60, "required": true, "auto": false},
    {"key": "hero_title", "type": "text", "label": "Hero headline", "required": true, "auto": false},
    {"key": "hero_carousel", "type": "carousel", "label": "Hero slider", "count": 3, "slide_width": 1200, "slide_height": 600, "required": true, "auto": false},
    {"key": "shop_name", "type": "text", "label": "Shop name", "auto": true, "required": false},
    {"key": "products_catalog", "type": "text", "label": "Products", "auto": true, "required": false}
  ],
  "instructions": "Plain English: tell the shop owner what to upload (logo size, carousel count, etc.)",
  "patched_html": "<!DOCTYPE html>... full html with {{placeholders}} ..."
}

Rules:
- patched_html must be complete valid HTML.
- Every non-auto variable must appear as {{key}} somewhere in patched_html.
- Carousel slides use {{hero_carousel_1_image}}, {{hero_carousel_1_title}}, etc. OR use carousel type and we expand at render time.
- Do not leave demo brand names or placeholder stock photo URLs in patched_html — replace with {{variables}}.
- If unsure about product area, wrap it or insert {{products_catalog}} in the main product section."""


def _infer_type(key: str) -> str:
    lower = key.lower()
    if "carousel" in lower or "slider" in lower or "slide" in lower:
        return "carousel"
    if any(w in lower for w in ("logo", "image", "img", "photo", "banner", "icon")):
        return "image"
    if "url" in lower or "link" in lower or "href" in lower:
        return "url"
    if "color" in lower or "colour" in lower:
        return "color"
    if "description" in lower or "paragraph" in lower or "about" in lower:
        return "textarea"
    return "text"


def _infer_carousel_count(keys: set[str], base: str) -> int:
    pattern = re.compile(rf"{re.escape(base)}[_-]?(\d+)", re.I)
    nums = [int(m.group(1)) for key in keys for m in [pattern.search(key)] if m]
    return max(nums) if nums else 3


def _label(key: str) -> str:
    return key.replace("_", " ").strip().title()


def _merge_variables(*groups: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for group in groups:
        for var in group:
            key = var.get("key")
            if not key:
                continue
            by_key[key] = {**by_key.get(key, {}), **var}
    # Standard auto vars first, then rest alphabetically
    auto_keys = {v["key"] for v in STANDARD_AUTO_VARIABLES}
    ordered = []
    for std in STANDARD_AUTO_VARIABLES:
        if std["key"] in by_key:
            ordered.append(by_key.pop(std["key"]))
        else:
            ordered.append(std)
    ordered.extend(sorted(by_key.values(), key=lambda v: v.get("key", "")))
    return ordered


def regex_analysis(html: str) -> dict[str, Any]:
    keys = set(PLACEHOLDER_RE.findall(html))
    variables: list[dict[str, Any]] = []
    seen_carousel: set[str] = set()

    for key in sorted(keys):
        vtype = _infer_type(key)
        if vtype == "carousel":
            base = re.sub(r"[_-]?\d+.*$", "", key)
            if base in seen_carousel:
                continue
            seen_carousel.add(base)
            variables.append(
                {
                    "key": base,
                    "type": "carousel",
                    "label": _label(base),
                    "count": _infer_carousel_count(keys, base),
                    "slide_width": 1200,
                    "slide_height": 600,
                    "required": True,
                    "auto": False,
                }
            )
            continue

        if re.search(r"[_-]\d+$", key) and _infer_type(re.sub(r"[_-]\d+$", "", key)) == "carousel":
            continue

        entry: dict[str, Any] = {
            "key": key,
            "type": vtype,
            "label": _label(key),
            "required": key not in {v["key"] for v in STANDARD_AUTO_VARIABLES},
            "auto": key in {v["key"] for v in STANDARD_AUTO_VARIABLES},
        }
        if vtype == "image":
            entry["width"] = 800
            entry["height"] = 600
        variables.append(entry)

    return {
        "variables": _merge_variables(variables),
        "instructions": (
            "Fill in logo, banner and carousel images for your shop. "
            "Shop name, description and products are filled automatically from your catalog."
        ),
        "patched_html": None,
    }


def heuristic_analysis(html: str) -> dict[str, Any]:
    """Detect storefront slots from typical e-commerce HTML (even without {{placeholders}})."""
    variables: list[dict[str, Any]] = []
    patched = html

    # Shop name: h1 inside .logo or site branding
    logo_h1 = re.search(r'<div[^>]*class="[^"]*logo[^"]*"[^>]*>\s*<h1[^>]*>(.*?)</h1>', html, re.I | re.S)
    if logo_h1:
        inner = re.sub(r"<[^>]+>", "", logo_h1.group(1)).strip()
        if inner and "{{" not in inner:
            patched = patched.replace(inner, "{{shop_name}}", 1)

    # Logo image in header/branding
    for m in IMG_RE.finditer(html):
        tag = m.group(0).lower()
        ctx = html[max(0, m.start() - 120) : m.end() + 40].lower()
        if any(w in tag or w in ctx for w in ("logo", "brand", "site-branding")):
            src = m.group(1)
            if "{{" not in src:
                variables.append(
                    {
                        "key": "logo",
                        "type": "image",
                        "label": "Header logo image",
                        "width": 200,
                        "height": 80,
                        "required": False,
                        "auto": False,
                    }
                )
                patched = patched.replace(f'src="{src}"', 'src="{{logo}}"', 1)
                patched = patched.replace(f"src='{src}'", "src='{{logo}}'", 1)
            break

    # Bootstrap / CSS hero slider (slides may use background CSS, not <img>)
    slider_area = re.search(
        r'<div[^>]*class="[^"]*(?:slider-area|hero|banner)[^"]*"[^>]*>(.*?)</div>\s*</div>\s*<!--\s*End slider',
        html,
        re.I | re.S,
    )
    slide_items = re.findall(r'<div[^>]*class="[^"]*item[^"]*"[^>]*>', slider_area.group(1) if slider_area else html)
    indicator_count = len(re.findall(r"data-slide-to=", html))
    slide_count = max(len(slide_items), indicator_count, 0)

    if slide_count >= 2:
        variables.append(
            {
                "key": "hero_carousel",
                "type": "carousel",
                "label": "Homepage slider banners",
                "count": slide_count,
                "slide_width": 1920,
                "slide_height": 600,
                "required": True,
                "auto": False,
            }
        )
        # Patch slide headings inside carousel
        slide_h2s = re.findall(r'<div[^>]*class="[^"]*slide-content[^"]*"[^>]*>.*?<h2[^>]*>(.*?)</h2>', html, re.I | re.S)
        for i, raw in enumerate(slide_h2s[:slide_count], start=1):
            text = re.sub(r"<[^>]+>", "", raw).strip()
            if text and "{{" not in text:
                patched = patched.replace(f"<h2>{text}</h2>", f"<h2>{{{{hero_carousel_{i}_title}}}}</h2>", 1)
                patched = patched.replace(f"<h2>{text}</h2>", f"<h2>{{{{hero_carousel_{i}_title}}}}</h2>", 1)
        # Patch CSS background slide divs
        for i, cls in enumerate(["slide-one", "slide-two", "slide-three", "slide-four", "slide-five"][:slide_count], start=1):
            pat = rf'(<div[^>]*class="[^"]*slide-bg\s+{cls}[^"]*"[^>]*)>'
            repl = rf'\1 style="background-image:url({{{{hero_carousel_{i}_image}}}})">'
            patched, n = re.subn(pat, repl, patched, count=1, flags=re.I)
            if n == 0:
                pat2 = rf'(<div[^>]*class="[^"]*{cls}[^"]*"[^>]*)>'
                patched, _ = re.subn(pat2, repl, patched, count=1, flags=re.I)

    # Product listing block → real shop catalog
    product_section = re.search(
        r'<div[^>]*class="[^"]*latest-product[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>\s*</div>\s*</div>',
        html,
        re.I | re.S,
    )
    if product_section:
        patched = patched.replace(product_section.group(0), "{{products_catalog}}", 1)
    elif re.search(r'class="[^"]*single-product', html, re.I):
        block = re.search(
            r'<div[^>]*class="[^"]*maincontent-area[^"]*"[^>]*>.*?</div>\s*</div>\s*<!--\s*End maincontent',
            html,
            re.I | re.S,
        )
        if block:
            patched = patched.replace(block.group(0), "<div class=\"maincontent-area\"><div class=\"container\">{{products_catalog}}</div></div>", 1)

    # Page title → shop name hint
    title_m = re.search(r"<title>([^<]+)</title>", html, re.I)
    if title_m and "{{shop_name}}" not in patched:
        title = title_m.group(1).strip()
        if title and "{{" not in title:
            patched = patched.replace(title, "{{shop_name}}", 1)

    merged = _merge_variables(variables)
    return {
        "variables": merged,
        "instructions": (
            "Upload slider banner images for each carousel slide. "
            "Your shop name, logo, description and product catalog (names, images, prices) are filled automatically from shop data."
        ),
        "patched_html": patched if patched != html else None,
    }


async def analyze_theme_html(html: str) -> dict[str, Any]:
    if not html.strip():
        return {"variables": list(STANDARD_AUTO_VARIABLES), "instructions": "Empty HTML file", "patched_html": html}

    regex_result = regex_analysis(html)
    heuristic_result = heuristic_analysis(html)

    merged_vars = _merge_variables(
        regex_result["variables"],
        heuristic_result["variables"],
    )
    fallback = {
        "variables": merged_vars,
        "instructions": heuristic_result["instructions"],
        "patched_html": heuristic_result.get("patched_html") or regex_result.get("patched_html"),
    }

    settings = get_settings()
    if not settings.chatgpt_api_key:
        logger.warning("CHATGPT_API_KEY not set — using heuristic theme analysis")
        return fallback

    snippet = html[:80000]
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.chatgpt_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": (
                                "Analyze this storefront HTML template. "
                                "Identify what each shop must customize and return patched_html with {{placeholders}}.\n\n"
                                + snippet
                            ),
                        },
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
            res.raise_for_status()
            payload = res.json()
            content = payload["choices"][0]["message"]["content"]
            data = json.loads(content)
            ai_vars = data.get("variables") or []
            if not isinstance(ai_vars, list):
                ai_vars = []
            final_vars = _merge_variables(ai_vars, merged_vars)
            patched = data.get("patched_html") or fallback.get("patched_html")
            if len([v for v in final_vars if not v.get("auto")]) == 0:
                final_vars = merged_vars
                patched = fallback.get("patched_html")
            return {
                "variables": final_vars,
                "instructions": data.get("instructions") or fallback["instructions"],
                "patched_html": patched,
            }
    except Exception as exc:
        logger.exception("ChatGPT theme analysis failed: %s", exc)
        return fallback
