// dashboard/js/module/variant.js
window.Dashboard = window.Dashboard || {};
Dashboard.modules = Dashboard.modules || {};

Dashboard.modules.variant = {
  template: tpl("tpl-variant"),

  data() {
    return {
      // product selection
      categories: [],
      subCategories: [],
      products: [],
      categoryId: 0,
      subCategoryId: 0,
      productId: 0,

      // groups
      groups: [],
      includeInactive: true,
      q: "",

      isGroupEdit: false,
      groupSaving: false,
      groupError: "",
      groupForm: {
        id: null,
        name: "",
        is_required: false,
        max_select: 1,
        sort_order: 0,
        is_active: true,
      },

      // values modal
      currentGroup: null,
      values: [],
      valuesIncludeInactive: true,
      vq: "",

      isValueEdit: false,
      valueSaving: false,
      valueError: "",
      valueForm: {
        id: null,
        name: "",
        extra_price: 0,
        sort_order: 0,
        is_active: true,
      },
    };
  },

  computed: {
    filteredGroups() {
      const q = (this.q || "").toLowerCase().trim();
      if (!q) return this.groups || [];
      return (this.groups || []).filter(g => (g.name || "").toLowerCase().includes(q));
    },
    filteredValues() {
      const q = (this.vq || "").toLowerCase().trim();
      if (!q) return this.values || [];
      return (this.values || []).filter(v => (v.name || "").toLowerCase().includes(q));
    }
  },

  mounted() {
    if (window.pywebview?.api) this.init();
    else window.addEventListener("pywebviewready", () => this.init(), { once: true });
  },

  methods: {
    formatMoney(v) {
      const n = Number(v || 0);
      return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    async init() {
      await this.loadCategories();
      if ((this.categories || []).length && !this.categoryId) this.categoryId = this.categories[0].id;
      await this.onChangeCategory();
    },

    async loadCategories() {
      try {
        const res = await Api.call("category_list", true);
        this.categories = (res?.status === "ok") ? (res.data || []) : [];
      } catch (e) {
        console.error(e);
        this.categories = [];
      }
    },

    async onChangeCategory() {
      this.subCategories = [];
      this.products = [];
      this.groups = [];
      this.categoryId = Number(this.categoryId || 0);
      this.subCategoryId = 0;
      this.productId = 0;

      if (!this.categoryId) return;

      const res = await Api.call("sub_category_list", this.categoryId, true);
      this.subCategories = (res?.status === "ok") ? (res.data || []) : [];

      if ((this.subCategories || []).length) {
        this.subCategoryId = this.subCategories[0].id;
        await this.onChangeSubCategory();
      }
    },

    async onChangeSubCategory() {
      this.products = [];
      this.groups = [];
      this.subCategoryId = Number(this.subCategoryId || 0);
      this.productId = 0;

      if (!this.subCategoryId) return;

      const res = await Api.call("product_list", this.subCategoryId, true);
      this.products = (res?.status === "ok") ? (res.data || []) : [];

      if ((this.products || []).length) {
        this.productId = this.products[0].id;
        await this.loadGroups();
      }
    },

    async loadGroups() {
      try {
        if (!this.productId) {
          this.groups = [];
          return;
        }

        Dashboard.router.setFooter("Loading variant groups...");
        const res = await Api.call("variant_group_list", this.productId, this.includeInactive);
        if (res?.status !== "ok") throw new Error(res?.message || "Load failed");

        this.groups = res.data || [];
        Dashboard.router.setFooter(`Groups: ${this.groups.length}`);
      } catch (e) {
        console.error(e);
        Dashboard.router.setFooter("Load failed ❌");
      }
    },

    openCreateGroup() {
      this.isGroupEdit = false;
      this.groupError = "";
      this.groupSaving = false;

      this.groupForm = {
        id: null,
        name: "",
        is_required: false,
        max_select: 1,
        sort_order: 0,
        is_active: true,
      };

      $("#groupModal").modal("show");
    },

    openEditGroup(g) {
      this.isGroupEdit = true;
      this.groupError = "";
      this.groupSaving = false;

      this.groupForm = {
        id: g.id,
        name: g.name || "",
        is_required: !!g.is_required,
        max_select: Number(g.max_select || 1),
        sort_order: Number(g.sort_order || 0),
        is_active: !!g.is_active,
      };

      $("#groupModal").modal("show");
    },

    async saveGroup() {
      this.groupError = "";

      if (!this.productId) {
        this.groupError = "Select a product first.";
        return;
      }
      if (!this.groupForm.name || !this.groupForm.name.trim()) {
        this.groupError = "Group name is required.";
        return;
      }
      if (Number(this.groupForm.max_select || 0) < 1) {
        this.groupError = "Max select must be >= 1.";
        return;
      }

      this.groupSaving = true;
      try {
        const payload = {
          product_id: Number(this.productId),
          name: this.groupForm.name.trim(),
          is_required: this.groupForm.is_required ? 1 : 0,
          max_select: Number(this.groupForm.max_select || 1),
          sort_order: Number(this.groupForm.sort_order || 0),
          is_active: this.groupForm.is_active ? 1 : 0
        };

        let res;
        if (this.isGroupEdit) res = await Api.call("variant_group_update", this.groupForm.id, payload);
        else res = await Api.call("variant_group_create", payload);

        if (res?.status !== "ok") throw new Error(res?.message || "Save failed");

        $("#groupModal").modal("hide");
        await this.loadGroups();
        Dashboard.router.setFooter("Saved ✅");
      } catch (e) {
        console.error(e);
        this.groupError = e.message || "Save failed";
      } finally {
        this.groupSaving = false;
      }
    },

    async toggleGroup(g) {
      try {
        const next = g.is_active ? 0 : 1;
        const res = await Api.call("variant_group_toggle", g.id, next);
        if (res?.status !== "ok") throw new Error(res?.message || "Toggle failed");
        await this.loadGroups();
      } catch (e) {
        console.error(e);
        alert(e.message || "Toggle failed");
      }
    },

    async removeGroup(g) {
      if (!confirm(`Delete group "${g.name}"?`)) return;
      try {
        const res = await Api.call("variant_group_delete", g.id);
        if (res?.status !== "ok") throw new Error(res?.message || "Delete failed");
        await this.loadGroups();
      } catch (e) {
        console.error(e);
        alert(e.message || "Delete failed");
      }
    },

    // ===== Values =====
    async openValues(g) {
      this.currentGroup = g;
      this.vq = "";
      this.values = [];
      this.resetValueForm();

      $("#valuesModal").modal("show");
      await this.loadValues();
    },

    async loadValues() {
      try {
        if (!this.currentGroup?.id) {
          this.values = [];
          return;
        }

        const res = await Api.call("variant_value_list", this.currentGroup.id, this.valuesIncludeInactive);
        if (res?.status !== "ok") throw new Error(res?.message || "Load failed");
        this.values = res.data || [];
      } catch (e) {
        console.error(e);
        this.values = [];
      }
    },

    openCreateValue() {
      this.isValueEdit = false;
      this.valueError = "";
      this.valueSaving = false;
      this.valueForm = { id: null, name: "", extra_price: 0, sort_order: 0, is_active: true };
    },

    openEditValue(v) {
      this.isValueEdit = true;
      this.valueError = "";
      this.valueSaving = false;
      this.valueForm = {
        id: v.id,
        name: v.name || "",
        extra_price: Number(v.extra_price || 0),
        sort_order: Number(v.sort_order || 0),
        is_active: !!v.is_active
      };
    },

    resetValueForm() {
      this.isValueEdit = false;
      this.valueError = "";
      this.valueSaving = false;
      this.valueForm = { id: null, name: "", extra_price: 0, sort_order: 0, is_active: true };
    },

    async saveValue() {
      this.valueError = "";

      if (!this.currentGroup?.id) {
        this.valueError = "No group selected.";
        return;
      }
      if (!this.valueForm.name || !this.valueForm.name.trim()) {
        this.valueError = "Value name is required.";
        return;
      }

      this.valueSaving = true;
      try {
        const payload = {
          group_id: Number(this.currentGroup.id),
          name: this.valueForm.name.trim(),
          extra_price: Number(this.valueForm.extra_price || 0),
          sort_order: Number(this.valueForm.sort_order || 0),
          is_active: this.valueForm.is_active ? 1 : 0
        };

        let res;
        if (this.isValueEdit) res = await Api.call("variant_value_update", this.valueForm.id, payload);
        else res = await Api.call("variant_value_create", payload);

        if (res?.status !== "ok") throw new Error(res?.message || "Save failed");

        await this.loadValues();
        this.resetValueForm();
      } catch (e) {
        console.error(e);
        this.valueError = e.message || "Save failed";
      } finally {
        this.valueSaving = false;
      }
    },

    async toggleValue(v) {
      try {
        const next = v.is_active ? 0 : 1;
        const res = await Api.call("variant_value_toggle", v.id, next);
        if (res?.status !== "ok") throw new Error(res?.message || "Toggle failed");
        await this.loadValues();
      } catch (e) {
        console.error(e);
        alert(e.message || "Toggle failed");
      }
    },

    async removeValue(v) {
      if (!confirm(`Delete value "${v.name}"?`)) return;
      try {
        const res = await Api.call("variant_value_delete", v.id);
        if (res?.status !== "ok") throw new Error(res?.message || "Delete failed");
        await this.loadValues();
      } catch (e) {
        console.error(e);
        alert(e.message || "Delete failed");
      }
    }
  }
};
