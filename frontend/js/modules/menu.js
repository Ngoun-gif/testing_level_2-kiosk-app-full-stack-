// frontend/js/modules/menu.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules.menu = {
  template: tpl("tpl-menu"),

  data() {
    return {
      router: Kiosk.router,

      store: {
        loading: true,
        error: "",

        categories: [],
        subCategories: [],
        products: [],

        catalog: {
          categoryId: 0,
          subCategoryId: 0
        }
      },

      menuAll: {
        categories: [],
        sub_by_cat: {},
        prod_by_sub: {},
        group_by_product: {},
        value_by_group: {}
      },

      // ✅ for image cache busting
      renderTick: 0
    };
  },

  computed: {
    total() {
      const cart = this.router.state.cart || [];
      return cart.reduce((sum, i) => {
        const qty = Number(i.qty || 1);
        const line =
          (i.line_total != null)
            ? Number(i.line_total || 0)
            : (Number(i.base_price || 0) * qty);
        return sum + line;
      }, 0);
    },

    count() {
      const cart = this.router.state.cart || [];
      return cart.reduce((s, i) => s + Number(i.qty || 1), 0);
    },

    cartQtyByProduct() {
      const cart = this.router.state.cart || [];
      const map = {};
      for (const line of cart) {
        const pid = Number(line.product_id);
        const qty = Number(line.qty || 1);
        if (!pid) continue;
        map[pid] = (map[pid] || 0) + qty;
      }
      return map;
    },

    safeCategories() { return (this.store.categories || []).filter(Boolean); },
    safeSubCategories() { return (this.store.subCategories || []).filter(Boolean); },
    safeProducts() { return (this.store.products || []).filter(Boolean); }
  },

  mounted() {
    if (!this.router.state.service) {
      this.router.setFooter("Select service first");
      this.router.go("service");
      return;
    }

    if (window.pywebview?.api) this.initMenu();
    else window.addEventListener("pywebviewready", () => this.initMenu(), { once: true });
  },

  methods: {
    // ✅ image resolver: prefer backend-provided file URL
    img(objOrPath) {
      // allow both: img(row) or img("uploads/..")
      let url = "";

      if (typeof objOrPath === "string") {
        // raw string path
        url = objOrPath;
      } else if (objOrPath && typeof objOrPath === "object") {
        // prefer image_url from backend
        url = objOrPath.image_url || objOrPath.imageUrl || objOrPath.image || objOrPath.image_path || "";
      }

      if (!url) return "./assets/placeholder.png";

      // If backend gives file:///... use it directly (best)
      if (String(url).startsWith("file:///")) {
        return String(url) + "?v=" + this.renderTick;
      }

      // fallback: relative paths (dev only / if you haven't updated backend yet)
      const clean = String(url).replace(/^\/+/, "");
      return "./" + clean + "?v=" + this.renderTick;
    },

    goService() { this.router.go("service"); },
    goCheckout() { this.router.go("cart"); },

    async initMenu() {
      this.store.loading = true;
      this.store.error = "";
      this.router.setFooter("Loading menu...");

      try {
        const res = await Api.call("kiosk_menu_all");
        if (res?.status !== "ok") throw new Error(res?.message || "Menu load failed");

        this.menuAll = res.data || this.menuAll;

        // ✅ share for product-variant page
        this.router.state.menuAll = this.menuAll;

        this.store.categories = (this.menuAll.categories || []).filter(Boolean);

        if (!this.store.categories.length) {
          this.store.error = "No categories";
          this.router.setFooter("No categories");
          return;
        }

        // bump cache buster when menu reloads
        this.renderTick++;

        const prev = Number(this.store.catalog.categoryId || this.router.state.categoryId || 0);
        const exists = this.store.categories.some(c => Number(c.id) === prev);
        const catId = exists ? prev : Number(this.store.categories[0].id);

        this.selectCategory(catId, { silent: true });
        this.router.setFooter("Menu ready ✅");
      } catch (e) {
        console.error(e);
        this.store.error = e.message || "Menu load failed";
        this.router.setFooter("Menu load failed ❌");
      } finally {
        this.store.loading = false;
      }
    },

    selectCategory(categoryId, opts = {}) {
      const id = Number(categoryId || 0);
      if (!id) return;

      this.router.state.categoryId = id;
      this.store.catalog.categoryId = id;

      // reset sub selection
      this.router.state.subCategoryId = 0;
      this.store.catalog.subCategoryId = 0;

      // load subcategories
      this.store.subCategories = (this.menuAll.sub_by_cat?.[id] || []).filter(Boolean);
      this.store.products = [];

      if (!opts.silent) this.router.setFooter("Category selected");

      // auto select first subcategory
      if (this.store.subCategories.length) {
        const firstSubId = Number(this.store.subCategories[0].id);
        this.selectSubCategory(firstSubId, { silent: true });
      } else {
        if (!opts.silent) this.router.setFooter("No sub-categories");
      }
    },

    selectSubCategory(subCategoryId, opts = {}) {
      const id = Number(subCategoryId || 0);
      if (!id) return;

      this.router.state.subCategoryId = id;
      this.store.catalog.subCategoryId = id;

      this.store.products = (this.menuAll.prod_by_sub?.[id] || []).filter(Boolean);

      if (!opts.silent) {
        this.router.setFooter(this.store.products.length ? "Products loaded" : "No products");
      }
    },

    openProduct(p) {
      if (!p?.id) return;

      const pid = Number(p.id);
      const cart = this.router.state.cart || [];

      // find last cart line of this product
      let editIndex = -1;
      for (let i = cart.length - 1; i >= 0; i--) {
        if (Number(cart[i]?.product_id) === pid) { editIndex = i; break; }
      }

      this.router.state.productId = pid;
      this.router.state.editCartIndex = (editIndex >= 0) ? editIndex : null;
      this.router.go("product-variant");
    }
  }
};
