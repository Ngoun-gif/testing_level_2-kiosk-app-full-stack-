// frontend/js/modules/service.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules.service = {
  template: tpl("tpl-service"),

  computed: {
    service() {
      return Kiosk.router.state.service;
    }
  },

  mounted() {
    // default selection
    if (!Kiosk.router.state.service) {
      Kiosk.router.state.service = "dine_in";
    }
    Kiosk.router.setFooter("Select service");
  },

  methods: {
    goSplash() {
      Kiosk.router.go("splash");
    },

    selectService(mode) {
      if (mode !== "dine_in" && mode !== "take_away") return;
      Kiosk.router.state.service = mode;
      Kiosk.router.setFooter(`Service: ${mode}`);
    },

    continueService() {
      if (!Kiosk.router.state.service) return;
      Kiosk.router.go("menu");
    }
  }
};
