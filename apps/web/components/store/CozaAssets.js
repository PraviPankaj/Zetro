"use client";

import { useEffect } from "react";

const COZA = "/cozastore";

const STYLES = [
  `${COZA}/vendor/bootstrap/css/bootstrap.min.css`,
  `${COZA}/fonts/font-awesome-4.7.0/css/font-awesome.min.css`,
  `${COZA}/fonts/iconic/css/material-design-iconic-font.min.css`,
  `${COZA}/fonts/linearicons-v1.0.0/icon-font.min.css`,
  `${COZA}/vendor/animate/animate.css`,
  `${COZA}/vendor/css-hamburgers/hamburgers.min.css`,
  `${COZA}/vendor/animsition/css/animsition.min.css`,
  `${COZA}/vendor/select2/select2.min.css`,
  `${COZA}/vendor/slick/slick.css`,
  `${COZA}/vendor/perfect-scrollbar/perfect-scrollbar.css`,
  `${COZA}/css/util.css`,
  `${COZA}/css/main.css`,
];

export const COZA_ASSETS = COZA;

export default function CozaAssets() {
  useEffect(() => {
    const links = [];
    for (const href of STYLES) {
      if (document.querySelector(`link[data-coza="${href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-coza", href);
      document.head.appendChild(link);
      links.push(link);
    }
    document.body.classList.add("coza-storefront");
    return () => {
      document.body.classList.remove("coza-storefront");
      // keep styles cached across storefront navigations
    };
  }, []);

  return null;
}
