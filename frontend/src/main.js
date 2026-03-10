import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

(async () => {
  const auth = useAuthStore(pinia);
  await auth.bootstrap();

  app.use(router);
  app.mount("#app");
})();
