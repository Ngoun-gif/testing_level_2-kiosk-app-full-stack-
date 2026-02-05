// frontend/js/modules/cart.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules["cart"] = {
  template: tpl("tpl-cart"),

  data() {
    return {
      router: Kiosk.router,
      renderTick: 0
    };
  },

  computed: {
    lines() {
      return (this.router.state.cart || []).filter(Boolean);
    },

    total() {
      const cart = this.router.state.cart || [];
      return cart.reduce((sum, i) => sum + Number(i?.line_total || 0), 0);
    },

    count() {
      const cart = this.router.state.cart || [];
      return cart.reduce((s, i) => s + Number(i?.qty || 1), 0);
    }
  },

  methods: {
    // ✅ EXE-safe image resolver: prefer image_url
    img(lineOrPath) {
      if (!lineOrPath) return "./assets/placeholder.png";

      let url = "";
      if (typeof lineOrPath === "string") {
        url = lineOrPath;
      } else if (typeof lineOrPath === "object") {
        url = lineOrPath.image_url || lineOrPath.imageUrl || lineOrPath.image_path || "";
      }

      if (!url) return "./assets/placeholder.png";

      if (String(url).startsWith("file:///")) {
        return String(url) + "?v=" + this.renderTick;
      }

      const clean = String(url).replace(/^\/+/, "");
      return "./" + clean + "?v=" + this.renderTick;
    },

    // ✅ Group variants by group_name (for cart UI)
    groupVariants(variants) {
      const map = {};
      (variants || []).forEach(v => {
        const g = v.group_name || "Options";
        if (!map[g]) map[g] = [];
        map[g].push(v);
      });

      // optional: keep stable order by group_name
      const ordered = {};
      Object.keys(map).sort().forEach(k => ordered[k] = map[k]);
      return ordered;
    },

    goMenu() {
      this.router.go("menu");
    },

    _recalcLine(line) {
      const base = Number(line.base_price || 0);
      const extras = (line.variants || []).reduce((s, v) => s + Number(v.extra_price || 0), 0);
      line.line_total = (base + extras) * Number(line.qty || 1);
    },

    incQty(index) {
      const cart = this.router.state.cart || [];
      const line = cart[index];
      if (!line) return;

      line.qty = Math.min(99, Number(line.qty || 1) + 1);
      this._recalcLine(line);

      this.router.state.cart = cart;
    },

    decQty(index) {
      const cart = this.router.state.cart || [];
      const line = cart[index];
      if (!line) return;

      line.qty = Math.max(1, Number(line.qty || 1) - 1);
      this._recalcLine(line);

      this.router.state.cart = cart;
    },

    removeItem(index) {
      const cart = this.router.state.cart || [];
      if (index < 0 || index >= cart.length) return;

      cart.splice(index, 1);
      this.router.state.cart = cart;
      this.router.setFooter("Removed ✅");
      this.renderTick++;
    },

    editItem(index) {
      const cart = this.router.state.cart || [];
      const line = cart[index];
      if (!line) return;

      this.router.state.productId = Number(line.product_id);
      this.router.state.editCartIndex = index;
      this.router.go("product-variant");
    },

    confirmOrder() {
      if (this.count === 0) return;
      this.router.go("payment-method");
    }
  }
};
