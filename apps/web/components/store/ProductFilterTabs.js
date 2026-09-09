"use client";

/**
 * CozaStore-style category filter chips for product grids.
 */
export default function ProductFilterTabs({ items, active, onChange }) {
  return (
    <div className="coza-filter-tabs flex-w flex-l-m m-tb-10">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`coza-filter-chip stext-106 trans-04${isActive ? " is-active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
