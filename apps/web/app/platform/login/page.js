"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form } from "react-bootstrap";
import AuthCard from "../../../components/admin/AuthCard";
import { api, setTokens } from "../../../lib/api";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await api.platform.login(username, password);
      setTokens("platform", null, tokens);
      router.push("/platform");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard subtitle="Platform admin — sign in with username and password.">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Form onSubmit={onSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Username</Form.Label>
          <Form.Control value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Form.Group>
        <div className="d-grid">
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </div>
      </Form>
    </AuthCard>
  );
}
