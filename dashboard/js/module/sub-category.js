// dashboard/js/module/sub_category.js
window.Dashboard = window.Dashboard || {};
Dashboard.modules = Dashboard.modules || {};

Dashboard.modules.sub_category = {
  template: tpl("tpl-sub_category"),

  data() {
    return {
      categories: [],
      categoryId: 0,

      rows: [],
      includeInactive: true,
      q: "",

      isEdit: false,
      saving: false,
      errorMsg: "",

      form: {
        id: null,
        category_id: 0,
        name: "",
        sort_order: 0,
        is_active: true,
        image_base64: null,
      },

      previewUrl: null,

      // ✅ cache-buster for images
      renderTick: 0,
    };
  },

  computed: {
    filtered() {
      const q = (this.q || "").toLowerCase().trim();
      if (!q) return this.rows;
      return this.rows.filter(r => (r.name || "").toLowerCase().includes(q));
    }
  },

  mounted() {
    if (window.pywebview?.api) this.init();
    else window.addEventListener("pywebviewready", () => this.init(), { once: true });
  },

  methods: {
    async init() {
      await this.loadCategories();
      if (this.categories.length && !this.categoryId) {
        this.categoryId = this.categories[0].id;
      }
      if (this.categoryId) await this.load();
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

    async load() {
      try {
        if (!this.categoryId) {
          this.rows = [];
          return;
        }

        Dashboard.router.setFooter("Loading sub-categories...");
        const res = await Api.call("sub_category_list", this.categoryId, this.includeInactive);
        if (res?.status !== "ok") throw new Error(res?.message || "Load failed");

        this.rows = res.data || [];

        // ✅ bump tick so browser refreshes any file:/// image changes
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
        category_id: Number(this.categoryId || 0),
        name: "",
        sort_order: 0,
        is_active: true,
        image_base64: null
      };

      $("#subModal").modal("show");
    },

    openEdit(sc) {
      this.isEdit = true;
      this.errorMsg = "";
      this.saving = false;

      this.form = {
        id: sc.id,
        category_id: Number(sc.category_id || this.categoryId || 0),
        name: sc.name || "",
        sort_order: Number(sc.sort_order || 0),
        is_active: !!sc.is_active,
        image_base64: null
      };

      // ✅ Use backend-provided file URL
      this.previewUrl = sc.image_url || null;

      $("#subModal").modal("show");
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

      if (!this.form.category_id || this.form.category_id === 0) {
        this.errorMsg = "Category is required.";
        return;
      }

      if (!this.form.name || !this.form.name.trim()) {
        this.errorMsg = "Name is required.";
        return;
      }

      this.saving = true;
      try {
        const payload = {
          category_id: Number(this.form.category_id),
          name: this.form.name.trim(),
          sort_order: Number(this.form.sort_order || 0),
          is_active: this.form.is_active ? 1 : 0,
          image_base64: this.form.image_base64 || null
        };

        let res;
        if (this.isEdit) {
          res = await Api.call("sub_category_update", this.form.id, payload);
        } else {
          res = await Api.call("sub_category_create", payload);
        }

        if (res?.status !== "ok") throw new Error(res?.message || "Save failed");

        $("#subModal").modal("hide");

        this.categoryId = Number(payload.category_id);
        await this.load();

        Dashboard.router.setFooter("Saved ✅");
      } catch (e) {
        console.error(e);
        this.errorMsg = e.message || "Save failed";
      } finally {
        this.saving = false;
      }
    },

    async toggle(sc) {
      try {
        const next = sc.is_active ? 0 : 1;
        const res = await Api.call("sub_category_toggle", sc.id, next);
        if (res?.status !== "ok") throw new Error(res?.message || "Toggle failed");
        await this.load();
      } catch (e) {
        console.error(e);
        alert(e.message || "Toggle failed");
      }
    },

    async remove(sc) {
      if (!confirm(`Delete sub-category "${sc.name}"?`)) return;
      try {
        const res = await Api.call("sub_category_delete", sc.id);
        if (res?.status !== "ok") throw new Error(res?.message || "Delete failed");
        await this.load();
      } catch (e) {
        console.error(e);
        alert(e.message || "Delete failed");
      }
    }
  }
};
