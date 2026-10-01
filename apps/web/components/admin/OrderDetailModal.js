"use client";

import { Modal, Table, Button } from "react-bootstrap";
import StatusBadge from "./StatusBadge";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function OrderDetailModal({
  order,
  show,
  onHide,
  onStatusChange,
  statuses,
  billingMode = false,
}) {
  if (!order) return null;

  const address = order.shipping_address || {};
  const isCancelled = order.status === "cancelled";
  const hasTax = (order.items || []).some((i) => Number(i.tax_amount) > 0) || Number(order.tax_amount) > 0;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {billingMode ? "Bill" : "Order"} {order.order_number}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="text-muted small">Status</div>
            <StatusBadge status={order.status} />
          </div>
          <div className="col-md-4">
            <div className="text-muted small">Payment</div>
            <div>
              <StatusBadge status={order.payment_status} />{" "}
              <span className="text-muted small text-capitalize">({order.payment_provider})</span>
            </div>
          </div>
          <div className="col-md-4">
            <div className="text-muted small">Total</div>
            <div className="fw-semibold">{money(order.total)}</div>
            {order.discount_amount > 0 ? (
              <small className="text-success">
                Discount {money(order.discount_amount)}
                {order.coupon_code ? ` (${order.coupon_code})` : ""}
              </small>
            ) : null}
          </div>
        </div>

        <h6 className="mb-2">Customer</h6>
        <div className="mb-4 text-muted small">
          <div>{address.name || "—"}</div>
          <div>{address.phone || "—"}</div>
          <div>{address.line1 || address.address_line1 || address.address || "—"}</div>
          {address.city ? (
            <div>
              {address.city}
              {address.state ? `, ${address.state}` : ""}
              {address.pincode ? ` ${address.pincode}` : ""}
            </div>
          ) : null}
        </div>

        <h6 className="mb-2">Items</h6>
        <Table responsive size="sm" className="mb-4">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
              {hasTax ? <th>GST</th> : null}
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, i) => (
              <tr key={i}>
                <td>
                  {item.product_name}
                  {item.variant_name && item.variant_name !== "Default" ? (
                    <small className="text-muted d-block">{item.variant_name}</small>
                  ) : null}
                </td>
                <td>{item.quantity}</td>
                <td>{money(item.unit_price)}</td>
                <td>{money(item.line_total)}</td>
                {hasTax ? (
                  <td className="text-nowrap">
                    {Number(item.tax_amount) > 0 ? (
                      <>
                        {money(item.tax_amount)}{" "}
                        <small className="text-muted">@ {Number(item.gst_rate || 0)}%</small>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {hasTax || Number(order.round_off) ? (
            <tfoot>
              <tr>
                <td colSpan={hasTax ? 3 : 3} className="text-end text-muted small">
                  Subtotal
                </td>
                <td colSpan={hasTax ? 2 : 1} className="small">
                  {money(order.subtotal)}
                </td>
              </tr>
              {hasTax ? (
                <tr>
                  <td colSpan={3} className="text-end text-muted small">
                    GST
                  </td>
                  <td colSpan={2} className="small">
                    {money(order.tax_amount)}
                  </td>
                </tr>
              ) : null}
              {Number(order.round_off) ? (
                <tr>
                  <td colSpan={hasTax ? 3 : 3} className="text-end text-muted small">
                    Round off
                  </td>
                  <td colSpan={hasTax ? 2 : 1} className="small">
                    {money(order.round_off)}
                  </td>
                </tr>
              ) : null}
            </tfoot>
          ) : null}
        </Table>

        {billingMode ? (
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {!isCancelled ? (
              <>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => onStatusChange?.(order.id, "cancelled")}
                >
                  Cancel &amp; refund
                </Button>
                <small className="text-muted">
                  Restores stock and sets payment to refunded.
                </small>
              </>
            ) : (
              <small className="text-muted">This bill was cancelled; stock was restored.</small>
            )}
            {(statuses || [])
              .filter((s) => s !== "cancelled")
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-sm ${order.status === s ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => onStatusChange?.(order.id, s)}
                  disabled={isCancelled}
                >
                  {s}
                </button>
              ))}
          </div>
        ) : statuses?.length ? (
          <>
            <h6 className="mb-2">Update status</h6>
            <div className="d-flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-sm ${order.status === s ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => onStatusChange?.(order.id, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
