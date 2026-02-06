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

    // UI total only (backend recomputes official total)
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
    img(lineOrPath) {
      if (!lineOrPath) return "./assets/placeholder.png";

      let url = "";
      if (typeof lineOrPath === "string") url = lineOrPath;
      else if (typeof lineOrPath === "object") {
        url = lineOrPath.image_url || lineOrPath.imageUrl || lineOrPath.image_path || "";
      }

      if (!url) return "./assets/placeholder.png";

      if (String(url).startsWith("file:///")) return String(url) + "?v=" + this.renderTick;

      const clean = String(url).replace(/^\/+/, "");
      return "./" + clean + "?v=" + this.renderTick;
    },

    groupVariants(variants) {
      const map = {};
      (variants || []).forEach((v) => {
        const g = v.group_name || "Options";
        if (!map[g]) map[g] = [];
        map[g].push(v);
      });

      const ordered = {};
      Object.keys(map).sort().forEach((k) => (ordered[k] = map[k]));
      return ordered;
    },

    goMenu() {
      this.router.go("menu");
    },

    _recalcLine(line) {
      // UI-only recalc. Backend recomputes official total.
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

    async confirmOrder() {
      if (this.count === 0) return;

      if (!this.router.state.service) {
        this.router.setFooter("Please select service first");
        this.router.go("service");
        return;
      }

      try {
        // ✅ SAFE payload: only ids + qty (no prices/names)
        const items = (this.router.state.cart || [])
          .filter(Boolean)
          .map((line) => ({
            product_id: Number(line.product_id),
            qty: Number(line.qty || 1),
            variant_value_ids: [...new Set((line.variant_value_ids || []).map(Number))]
              .filter((v) => Number.isFinite(v))
          }));

        const payload = {
          session_key: this.router.state.sessionKey || "",
          service_type: this.router.state.service, // dine_in / take_away
          items
        };

        const res = await Api.call("order_create_from_cart", payload);
        if (res?.status !== "ok") {
          this.router.setFooter(res?.message || "Create order failed");
          return;
        }

        const data = res.data || {};
        this.router.state.orderId = data.order_id;
        this.router.state.orderNo = data.order_no;

        this.router.setFooter(`Order created: ${data.order_no}`);
        this.router.go("payment-method");
      } catch (e) {
        this.router.setFooter(String(e?.message || e || "Create order error"));
      }
    }
  }
};
