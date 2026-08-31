/**
 * Zetro API client — isomorphic fetch wrapper for web and future mobile apps.
 */

export class ZetroApiError extends Error {
  constructor(status, detail, body) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.name = "ZetroApiError";
    this.status = status;
    this.body = body;
  }
}

export function createClient({
  baseUrl = "http://localhost:8000",
  getToken = () => null,
} = {}) {
  const api = `${baseUrl.replace(/\/$/, "")}/api/v1`;

  async function request(path, { method = "GET", body, token, formData, headers } = {}) {
    const auth = token ?? getToken();
    const hdrs = { ...(headers || {}) };
    if (auth) hdrs.Authorization = `Bearer ${auth}`;
    let payload = undefined;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      hdrs["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${api}${path}`, { method, headers: hdrs, body: payload });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }
    }
    if (!res.ok) {
      const detail = data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || d).join(", ")
            : data;
      throw new ZetroApiError(res.status, message, data);
    }
    return data;
  }

  return {
    baseUrl,
    mediaUrl(path) {
      if (!path) return "";
      if (path.startsWith("http")) return path;
      return `${baseUrl.replace(/\/$/, "")}${path}`;
    },
    platform: {
      login: (username, password) =>
        request("/platform/auth/login", { method: "POST", body: { username, password } }),
      me: (token) => request("/platform/auth/me", { token }),
      changePassword: (current_password, new_password, token) =>
        request("/platform/auth/change-password", {
          method: "POST",
          body: { current_password, new_password },
          token,
        }),
      users: {
        list: (token) => request("/platform/users", { token }),
        create: (payload, token) =>
          request("/platform/users", { method: "POST", body: payload, token }),
      },
      roles: (token) => request("/platform/roles", { token }),
      permissions: (token) => request("/platform/permissions", { token }),
      shops: {
        list: (token) => request("/platform/shops", { token }),
        create: (payload, token) =>
          request("/platform/shops", { method: "POST", body: payload, token }),
        get: (id, token) => request(`/platform/shops/${id}`, { token }),
        update: (id, payload, token) =>
          request(`/platform/shops/${id}`, { method: "PATCH", body: payload, token }),
      },
      plans: (token) => request("/platform/plans", { token }),
    },
    shop: (slug) => ({
      info: () => request(`/shops/${slug}/info`),
      catalog: () => request(`/shops/${slug}/catalog`),
      product: (productSlug) => request(`/shops/${slug}/catalog/${productSlug}`),
      staffOtpRequest: (phone) =>
        request(`/shops/${slug}/auth/otp/request`, { method: "POST", body: { phone } }),
      staffOtpVerify: (phone, otp, name) =>
        request(`/shops/${slug}/auth/otp/verify`, {
          method: "POST",
          body: { phone, otp, name },
        }),
      customerOtpRequest: (phone) =>
        request(`/shops/${slug}/customer/auth/otp/request`, { method: "POST", body: { phone } }),
      customerOtpVerify: (phone, otp, name) =>
        request(`/shops/${slug}/customer/auth/otp/verify`, {
          method: "POST",
          body: { phone, otp, name },
        }),
      adminMe: (token) => request(`/shops/${slug}/admin/me`, { token }),
      plans: (token) => request(`/shops/${slug}/admin/plans`, { token }),
      subscription: (token) => request(`/shops/${slug}/admin/subscription`, { token }),
      activatePlan: (plan_code, token) =>
        request(`/shops/${slug}/admin/subscription/activate`, {
          method: "POST",
          body: { plan_code },
          token,
        }),
      categories: {
        list: (token) => request(`/shops/${slug}/admin/categories`, { token }),
        create: (payload, token) =>
          request(`/shops/${slug}/admin/categories`, { method: "POST", body: payload, token }),
      },
      products: {
        list: (token) => request(`/shops/${slug}/admin/products`, { token }),
        create: (payload, token) =>
          request(`/shops/${slug}/admin/products`, { method: "POST", body: payload, token }),
        update: (id, payload, token) =>
          request(`/shops/${slug}/admin/products/${id}`, { method: "PATCH", body: payload, token }),
        uploadImage: async (id, file, token) => {
          const formData = new FormData();
          formData.append("file", file);
          return request(`/shops/${slug}/admin/products/${id}/images`, {
            method: "POST",
            formData,
            token,
          });
        },
      },
      orders: {
        list: (token) => request(`/shops/${slug}/admin/orders`, { token }),
        setStatus: (id, status, token) =>
          request(`/shops/${slug}/admin/orders/${id}/status?status=${status}`, {
            method: "PATCH",
            token,
          }),
      },
      gateways: {
        list: (token) => request(`/shops/${slug}/admin/payments/gateways`, { token }),
        upsert: (payload, token) =>
          request(`/shops/${slug}/admin/payments/gateways`, {
            method: "PUT",
            body: payload,
            token,
          }),
      },
      cart: {
        get: (token) => request(`/shops/${slug}/cart`, { token }),
        add: (variant_id, quantity, token) =>
          request(`/shops/${slug}/cart/items`, {
            method: "POST",
            body: { variant_id, quantity },
            token,
          }),
        remove: (itemId, token) =>
          request(`/shops/${slug}/cart/items/${itemId}`, { method: "DELETE", token }),
      },
      checkout: (payload, token) =>
        request(`/shops/${slug}/checkout`, { method: "POST", body: payload, token }),
      myOrders: (token) => request(`/shops/${slug}/orders`, { token }),
      paymentMethods: () => request(`/shops/${slug}/payments/methods`),
    }),
  };
}

export default createClient;
