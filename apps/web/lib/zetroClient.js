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
        products: (id, token) => request(`/platform/shops/${id}/products`, { token }),
        createProduct: (id, payload, token) =>
          request(`/platform/shops/${id}/products`, { method: "POST", body: payload, token }),
        updateProduct: (id, productId, payload, token) =>
          request(`/platform/shops/${id}/products/${productId}`, {
            method: "PATCH",
            body: payload,
            token,
          }),
        deleteProduct: (id, productId, token) =>
          request(`/platform/shops/${id}/products/${productId}`, { method: "DELETE", token }),
        uploadImage: async (id, productId, file, token) => {
          const formData = new FormData();
          formData.append("file", file);
          return request(`/platform/shops/${id}/products/${productId}/images`, {
            method: "POST",
            formData,
            token,
          });
        },
        categories: (id, token) => request(`/platform/shops/${id}/categories`, { token }),
        createCategory: (id, payload, token) =>
          request(`/platform/shops/${id}/categories`, { method: "POST", body: payload, token }),
        updateSettings: (id, payload, token) =>
          request(`/platform/shops/${id}/settings`, { method: "PATCH", body: payload, token }),
        reports: (id, token) => request(`/platform/shops/${id}/reports`, { token }),
      },
      themes: (token) => request("/platform/themes", { token }),
      reports: (token) => request("/platform/reports", { token }),
      plans: (token) => request("/platform/plans", { token }),
    },
    register: {
      requestOtp: (phone) =>
        request("/register/otp/request", { method: "POST", body: { phone } }),
      verifyOtp: (phone, otp) =>
        request("/register/otp/verify", { method: "POST", body: { phone, otp } }),
      createShop: (registrationToken, { name, slug, logo }) => {
        const formData = new FormData();
        formData.append("name", name);
        if (slug) formData.append("slug", slug);
        if (logo) formData.append("logo", logo);
        return request("/register/shop", { method: "POST", formData, token: registrationToken });
      },
    },
    shop: (slug) => ({
      info: () => request(`/shops/${slug}/info`),
      catalog: (params = {}) => {
        const qs = new URLSearchParams();
        if (params.category) qs.set("category", params.category);
        if (params.q) qs.set("q", params.q);
        const query = qs.toString();
        return request(`/shops/${slug}/catalog${query ? `?${query}` : ""}`);
      },
      product: (productSlug) => request(`/shops/${slug}/catalog/${productSlug}`),
      themes: () => request(`/shops/${slug}/themes`),
      settings: {
        update: (payload, token) =>
          request(`/shops/${slug}/admin/settings`, { method: "PATCH", body: payload, token }),
      },
      staffOtpRequest: (phone) =>
        request(`/shops/${slug}/auth/otp/request`, { method: "POST", body: { phone } }),
      staffDemoLogin: () => request(`/shops/${slug}/auth/demo`, { method: "POST" }),
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
      customerMe: (token) => request(`/shops/${slug}/customer/me`, { token }),
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
        browse: () => request(`/shops/${slug}/categories`),
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
        delete: (id, token) =>
          request(`/shops/${slug}/admin/products/${id}`, { method: "DELETE", token }),
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
