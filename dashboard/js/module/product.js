// dashboard/js/module/product.js
window.Dashboard = window.Dashboard || {};
Dashboard.modules = Dashboard.modules || {};

Dashboard.modules.product = {
  template: tpl("tpl-product"),

  data() {
    return {
      categories: [],
      subCategories: [],

      categoryId: 0,
      subCategoryId: 0,

      rows: [],
      includeInactive: true,
      q: "",

      isEdit: false,
      saving: false,
      errorMsg: "",

      form: {
        id: null,
        sub_category_id: 0,
        name: "",
        sku: "",
        base_price: 0,
        sort_order: 0,
        is_active: true,
        image_base64: null,
      },

      previewUrl: null,

      // ✅ cache-buster
      renderTick: 0,
    };
  },

  computed: {
    filtered() {
      const q = (this.q || "").toLowerCase().trim();
      if (!q) return this.rows;
      return this.rows.filter(r =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.sku || "").toLowerCase().includes(q)
      );
    }
  },

  mounted() {
    if (window.pywebview?.api) this.init();
    else window.addEventListener("pywebviewready", () => this.init(), { once: true });
  },

  methods: {
    formatPrice(v) {
      const n = Number(v || 0);
      return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    async init() {
      await this.loadCategories();
      if (this.categories.length && !this.categoryId) {
        this.categoryId = this.categories[0].id;
      }
      if (this.categoryId) {
        await this.loadSubCategories();
        if (this.subCategories.length && !this.subCategoryId) {
          this.subCategoryId = this.subCategories[0].id;
        }
        if (this.subCategoryId) await this.load();
      }
    },

    async loadCategories() {
      try {
        const res = await Api.call("category_list", true);
        if (res?.status !== "ok") throw new Error(res?.message || "Load categories failed");
        this.categories = res.data || [];
      } catch (e) {
        console.error(e);
        this.categories = [];
      }
    },

    async loadSubCategories() {
      try {
        this.subCategories = [];
        this.subCategoryId = 0;
        this.rows = [];

        if (!this.categoryId) return;

        const res = await Api.call("sub_category_list", this.categoryId, true);
        if (res?.status !== "ok") throw new Error(res?.message || "Load sub-categories failed");

        this.subCategories = res.data || [];
      } catch (e) {
        console.error(e);
        this.subCategories = [];
      }
    },

    async onChangeCategory() {
      await this.loadSubCategories();
      if (this.subCategories.length) {
        this.subCategoryId = this.subCategories[0].id;
        await this.load();
      }
    },

    async load() {
      try {
        if (!this.subCategoryId) {
          this.rows = [];
          return;
        }

        Dashboard.router.setFooter("Loading products...");
        const res = await Api.call("product_list", this.subCategoryId, this.includeInactive);
        if (res?.status !== "ok") throw new Error(res?.message || "Load failed");

        this.rows = res.data || [];

        // ✅ bump tick so images refresh
        this.renderTick++;

        Dashboard.router.setFooter(`Loaded: ${this.rows.length}`);
      } catch (e) {
        console.error(e);
        Dashboard.router.setFooter("Load failed ❌");
      }
    },

    openCreate() {
      this.isEdit = false;
      this.errorMsg = "";
      this.saving = false;
      this.previewUrl = null;

      this.form = {
        id: null,
        sub_category_id: Number(this.subCategoryId || 0),
        name: "",
        sku: "",
        base_price: 0,
        sort_order: 0,
        is_active: true,
        image_base64: null
      };

      $("#prdModal").modal("show");
    },

    openEdit(p) {
      this.isEdit = true;
      this.errorMsg = "";
      this.saving = false;

      this.form = {
        id: p.id,
        sub_category_id: Number(p.sub_category_id || this.subCategoryId || 0),
        name: p.name || "",
        sku: p.sku || "",
        base_price: Number(p.base_price || 0),
        sort_order: Number(p.sort_order || 0),
        is_active: !!p.is_active,
        image_base64: null
      };

      // ✅ Use backend-provided file URL
      this.previewUrl = p.image_url || null;

      $("#prdModal").modal("show");
    },

    async onPickImage(e) {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        this.errorMsg = "Please select an image file.";
        e.target.value = "";
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        this.errorMsg = "Image too large (max 2MB).";
        e.target.value = "";
        return;
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      this.form.image_base64 = dataUrl;
      this.previewUrl = dataUrl;
      this.errorMsg = "";
    },

    async save() {
      this.errorMsg = "";

      if (!this.form.sub_category_id || this.form.sub_category_id === 0) {
        this.errorMsg = "Sub-category is required.";
        return;
      }
      if (!this.form.name || !this.form.name.trim()) {
        this.errorMsg = "Name is required.";
        return;
      }

      this.saving = true;
      try {
        const payload = {
          sub_category_id: Number(this.form.sub_category_id),
          sku: (this.form.sku || "").trim() || null,
          name: this.form.name.trim(),
          base_price: Number(this.form.base_price || 0),
          sort_order: Number(this.form.sort_order || 0),
          is_active: this.form.is_active ? 1 : 0,
          image_base64: this.form.image_base64 || null
        };

        let res;
        if (this.isEdit) {
          res = await Api.call("product_update", this.form.id, payload);
        } else {
          res = await Api.call("product_create", payload);
        }

        if (res?.status !== "ok") throw new Error(res?.message || "Save failed");

        $("#prdModal").modal("hide");

        this.subCategoryId = Number(payload.sub_category_id);
        await this.load();

        Dashboard.router.setFooter("Saved ✅");
      } catch (e) {
        console.error(e);
        this.errorMsg = e.message || "Save failed";
      } finally {
        this.saving = false;
      }
    },

    async toggle(p) {
      try {
        const next = p.is_active ? 0 : 1;
        const res = await Api.call("product_toggle", p.id, next);
        if (res?.status !== "ok") throw new Error(res?.message || "Toggle failed");
        await this.load();
      } catch (e) {
        console.error(e);
        alert(e.message || "Toggle failed");
      }
    },

    async remove(p) {
      if (!confirm(`Delete product "${p.name}"?`)) return;
      try {
        const res = await Api.call("product_delete", p.id);
        if (res?.status !== "ok") throw new Error(res?.message || "Delete failed");
        await this.load();
      } catch (e) {
        console.error(e);
        alert(e.message || "Delete failed");
      }
    }
  }
};
