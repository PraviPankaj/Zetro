"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Carousel({
  slides = [],
  interval = 5500,
  className = "",
  aspect = "hero",
  showDots = true,
  showArrows = true,
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(timer);
  }, [count, interval]);

  if (!count) return null;

  const slide = slides[index];

  return (
    <div className={`sf-carousel sf-carousel--${aspect} ${className}`.trim()}>
      <div className="sf-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <div className="sf-carousel-slide" key={s.id || s.image || i}>
            {s.href ? (
              <Link href={s.href} className="sf-carousel-media">
                <img src={s.image} alt={s.title || ""} />
              </Link>
            ) : (
              <div className="sf-carousel-media">
                <img src={s.image} alt={s.title || ""} />
              </div>
            )}
            {(s.title || s.subtitle || s.cta) && (
              <div className="sf-carousel-caption">
                {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
                {s.title ? <h2>{s.title}</h2> : null}
                {s.subtitle ? <p>{s.subtitle}</p> : null}
                {s.cta && s.href ? (
                  <Link href={s.href} className="sf-btn">
                    {s.cta}
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {showArrows && count > 1 ? (
        <>
          <button
            type="button"
            className="sf-carousel-nav sf-carousel-nav--prev"
            aria-label="Previous slide"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
          >
            ‹
          </button>
          <button
            type="button"
            className="sf-carousel-nav sf-carousel-nav--next"
            aria-label="Next slide"
            onClick={() => setIndex((i) => (i + 1) % count)}
          >
            ›
          </button>
        </>
      ) : null}

      {showDots && count > 1 ? (
        <div className="sf-carousel-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === index ? "is-active" : ""}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}

      {aspect === "hero" && slide?.overlayTitle === false ? null : null}
    </div>
  );
}
