// dashboard/app.js
const { createApp } = Vue;

function tpl(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.error("Template not found:", id);
    return "";
  }
  return el.innerHTML;
}

(function bootstrapDashboard() {
  const headerTpl  = tpl("tpl-layout-header");
  const sidebarTpl = tpl("tpl-layout-sidebar");
  const masterTpl  = tpl("tpl-layout-master");
  const footerTpl  = tpl("tpl-layout-footer");

  const dashboardTpl   = tpl("tpl-dashboard");
  const categoryTpl    = tpl("tpl-category");
  const subCategoryTpl = tpl("tpl-sub_category");
  const productTpl     = tpl("tpl-product");
  const variantTpl     = tpl("tpl-variant");

  const rootTemplate = `
    <div class="wrapper">
      ${headerTpl}
      ${sidebarTpl}
      ${masterTpl}
      ${footerTpl}
    </div>
  `;

  createApp({
    template: rootTemplate,
    data() {
      return {
        router: Dashboard.router,
        views: {
          dashboard:    { template: dashboardTpl },

          // ✅ use module if loaded, fallback to plain template
          category:     (Dashboard.modules?.category || { template: categoryTpl }),
          sub_category: (Dashboard.modules?.sub_category || { template: subCategoryTpl }),
          product: (Dashboard.modules?.product || { template: productTpl }),
          variant: (Dashboard.modules?.variant || { template: variantTpl }),

        }
      };
    },
    computed: {
      currentView() {
        // ✅ fallback to dashboard (or category if you prefer)
        return this.views[this.router.state.route] || this.views.dashboard;
      }
    },
    methods: {
      refresh() { this.router.setFooter("Refreshed ✅"); },
      logout()  { this.router.setFooter("Logout (TODO)"); }
    }
  }).mount("#adminApp");
})();
