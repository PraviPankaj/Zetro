"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { api, getToken } from "../../../lib/api";

export default function PlatformUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role_ids: [],
  });

  function load() {
    const token = getToken("platform");
    api.platform.users.list(token).then(setUsers);
    api.platform.roles(token).then(setRoles);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.platform.users.create(
        { ...form, role_ids: form.role_ids.map(Number) },
        getToken("platform")
      );
      setForm({ username: "", email: "", password: "", role_ids: [] });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2 className="mb-4">Platform users</h2>
      <Row>
        <Col lg={7}>
          <Card>
            <Table responsive className="text-nowrap mb-0">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{(u.roles || []).join(", ")}</td>
                    <td>{u.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={5}>
          <Card>
            <Card.Body>
              <h4>Invite user</h4>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <Form onSubmit={onSubmit}>
                <Form.Group className="mb-2">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Temporary password</Form.Label>
                  <Form.Control
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select
                    value={form.role_ids[0] || ""}
                    onChange={(e) => setForm({ ...form, role_ids: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">Select role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Button type="submit">Add user</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
