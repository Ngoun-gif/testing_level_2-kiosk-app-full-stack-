// kiosk_main/app.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

const { createApp } = Vue;

(function bootstrapKiosk() {
  const app = createApp({
    data() {
      return {
        router: Kiosk.router
      };
    },

    computed: {
      currentView() {
        return Kiosk.modules[this.router.state.route] || Kiosk.modules.splash;
      }
    },

    template: `
      <div class="kiosk-shell">
        <component :is="currentView"></component>
        <div class="kiosk-footer">{{ router.state.footerMsg }}</div>
      </div>
    `
  });

  // register all modules
  for (const [name, comp] of Object.entries(Kiosk.modules)) {
    app.component(name, comp);
  }

  app.mount("#kioskApp");

  // start at splash
  Kiosk.router.go("splash");
})();
