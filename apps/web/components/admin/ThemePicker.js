"use client";

import { STORE_THEMES } from "../../lib/storeThemes";

export default function ThemePicker({ value, onChange, saving }) {
  return (
    <div className="theme-picker-grid">
      {STORE_THEMES.map((theme) => {
        const active = value === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            className={`theme-picker-card${active ? " is-active" : ""}`}
            disabled={saving}
            onClick={() => onChange(theme.id)}
          >
            <div className="theme-picker-swatches">
              {theme.swatch.map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </div>
            <strong>{theme.name}</strong>
            <small>{theme.description}</small>
          </button>
        );
      })}
    </div>
  );
}
