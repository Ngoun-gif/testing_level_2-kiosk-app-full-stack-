// dashboard/js/module/category.js
window.Dashboard = window.Dashboard || {};
Dashboard.modules = Dashboard.modules || {};

Dashboard.modules.category = {
  template: tpl("tpl-category"),

  data() {
    return {
      rows: [],
      includeInactive: true,
      q: "",

      isEdit: false,
      saving: false,
      errorMsg: "",

      form: {
        id: null,
        name: "",
        sort_order: 0,
        is_active: true,
        image_base64: null,
      },

      // used for preview in modal
      previewUrl: null,

      // ✅ bump this to force img refresh (cache buster)
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
    // ✅ ensure python bridge is ready
    if (window.pywebview?.api) {
      this.load();
    } else {
      window.addEventListener("pywebviewready", () => this.load(), { once: true });
    }
  },

  methods: {
    async load() {
      try {
        Dashboard.router.setFooter("Loading categories...");
        const res = await Api.call("category_list", this.includeInactive);
        if (res?.status !== "ok") throw new Error(res?.message || "Load failed");

        // expected row fields:
        // id, name, sort_order, is_active, image_path, image_url
        this.rows = res.data || [];
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
      this.form = { id: null, name: "", sort_order: 0, is_active: true, image_base64: null };

      $("#catModal").modal("show");
    },

    openEdit(c) {
      this.isEdit = true;
      this.errorMsg = "";
      this.saving = false;

      this.form = {
        id: c.id,
        name: c.name || "",
        sort_order: Number(c.sort_order || 0),
        is_active: !!c.is_active,
        image_base64: null
      };

      // ✅ Use backend-provided image_url (file:///...)
      this.previewUrl = c.image_url || null;

      $("#catModal").modal("show");
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
      this.previewUrl = dataUrl; // show immediate preview
      this.errorMsg = "";
    },

    async save() {
      this.errorMsg = "";

      if (!this.form.name || !this.form.name.trim()) {
        this.errorMsg = "Name is required.";
        return;
      }

      this.saving = true;
      try {
        const payload = {
          name: this.form.name.trim(),
          sort_order: Number(this.form.sort_order || 0),
          is_active: this.form.is_active ? 1 : 0,
          image_base64: this.form.image_base64 || null
        };

        let res;
        if (this.isEdit) {
          res = await Api.call("category_update", this.form.id, payload);
        } else {
          res = await Api.call("category_create", payload);
        }

        if (res?.status !== "ok") throw new Error(res?.message || "Save failed");

        $("#catModal").modal("hide");

        // ✅ reload list and bump tick to prevent cached images
        await this.load();
        this.renderTick++;

        Dashboard.router.setFooter("Saved ✅");
      } catch (e) {
        console.error(e);
        this.errorMsg = e.message || "Save failed";
      } finally {
        this.saving = false;
      }
    },

    async toggle(c) {
      try {
        const next = c.is_active ? 0 : 1;
        const res = await Api.call("category_toggle", c.id, next);
        if (res?.status !== "ok") throw new Error(res?.message || "Toggle failed");

        await this.load();
        this.renderTick++;
      } catch (e) {
        console.error(e);
        alert(e.message || "Toggle failed");
      }
    },

    async remove(c) {
      if (!confirm(`Delete category "${c.name}"?`)) return;

      try {
        const res = await Api.call("category_delete", c.id);
        if (res?.status !== "ok") throw new Error(res?.message || "Delete failed");

        await this.load();
        this.renderTick++;
      } catch (e) {
        console.error(e);
        alert(e.message || "Delete failed");
      }
    }
  }
};
