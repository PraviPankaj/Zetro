"use client";

import { Card } from "react-bootstrap";

export default function KpiCard({ label, value, sub, variant = "default", icon }) {
  return (
    <Card className={`kpi-card kpi-card--${variant} h-100`}>
      <Card.Body className="d-flex align-items-start justify-content-between">
        <div>
          <div className="kpi-card__label">{label}</div>
          <div className="kpi-card__value">{value}</div>
          {sub ? <div className="kpi-card__sub">{sub}</div> : null}
        </div>
        {icon ? <div className="kpi-card__icon">{icon}</div> : null}
      </Card.Body>
    </Card>
  );
}
