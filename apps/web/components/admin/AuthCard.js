"use client";

import Link from "next/link";
import { Card, Col, Row } from "react-bootstrap";

export default function AuthCard({ title, subtitle, children, footer, wide = false }) {
  const colProps = wide
    ? { xxl: 7, lg: 9, md: 10, xs: 12 }
    : { xxl: 4, lg: 6, md: 8, xs: 12 };

  return (
    <Row className="align-items-center justify-content-center g-0 min-vh-100">
      <Col {...colProps} className="py-8 py-xl-0">
        <Card className="smooth-shadow-md">
          <Card.Body className="p-6">
            <div className="mb-4">
              <Link href="/" className="text-decoration-none">
                <span className="brand-mark me-2">Z</span>
                <strong className="fs-3 text-dark">Zetro</strong>
              </Link>
              <p className="mb-0 mt-3 text-muted">{subtitle || title}</p>
            </div>
            {children}
            {footer}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
