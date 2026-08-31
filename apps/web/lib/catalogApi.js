import { getToken } from "./api";
import { api } from "./api";

/** Shared catalog API for shop admin and platform admin. */
export function createShopCatalogApi(slug) {
  const token = () => getToken("shop", slug);
  return {
    listProducts: () => api.shop(slug).products.list(token()),
    createProduct: (payload) => api.shop(slug).products.create(payload, token()),
    updateProduct: (id, payload) => api.shop(slug).products.update(id, payload, token()),
    deleteProduct: (id) => api.shop(slug).products.delete(id, token()),
    uploadImage: (id, file) => api.shop(slug).products.uploadImage(id, file, token()),
    listCategories: () => api.shop(slug).categories.list(token()),
    createCategory: (payload) => api.shop(slug).categories.create(payload, token()),
    updateSettings: (payload) => api.shop(slug).settings.update(payload, token()),
    listThemes: () => api.shop(slug).themes(),
  };
}

export function createPlatformCatalogApi(shopId) {
  const id = Number(shopId);
  const token = () => getToken("platform");
  return {
    listProducts: () => api.platform.shops.products(id, token()),
    createProduct: (payload) => api.platform.shops.createProduct(id, payload, token()),
    updateProduct: (productId, payload) =>
      api.platform.shops.updateProduct(id, productId, payload, token()),
    deleteProduct: (productId) => api.platform.shops.deleteProduct(id, productId, token()),
    uploadImage: (productId, file) =>
      api.platform.shops.uploadImage(id, productId, file, token()),
    listCategories: () => api.platform.shops.categories(id, token()),
    createCategory: (payload) => api.platform.shops.createCategory(id, payload, token()),
    updateSettings: (payload) => api.platform.shops.updateSettings(id, payload, token()),
    listThemes: () => api.platform.themes(token()),
  };
}
