"use client";

const STATUS_VARIANTS = {
  pending: "warning",
  confirmed: "info",
  packed: "primary",
  shipped: "primary",
  delivered: "success",
  cancelled: "danger",
  paid: "success",
  failed: "danger",
  refunded: "secondary",
  active: "success",
  inactive: "secondary",
};

export default function StatusBadge({ status }) {
  const key = (status || "").toLowerCase();
  const variant = STATUS_VARIANTS[key] || "secondary";
  return <span className={`badge bg-${variant} text-capitalize`}>{status || "—"}</span>;
}
