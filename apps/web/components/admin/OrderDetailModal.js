"use client";

import { Modal, Table } from "react-bootstrap";
import StatusBadge from "./StatusBadge";

function money(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function OrderDetailModal({ order, show, onHide, onStatusChange, statuses }) {
  if (!order) return null;

  const address = order.shipping_address || {};

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Order {order.order_number}</Modal.Title>
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
          </div>
        </div>

        <h6 className="mb-2">Customer</h6>
        <div className="mb-4 text-muted small">
          <div>{address.name || "—"}</div>
          <div>{address.phone || "—"}</div>
          <div>{address.address_line1 || address.address || "—"}</div>
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
              </tr>
            ))}
          </tbody>
        </Table>

        {statuses?.length ? (
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
