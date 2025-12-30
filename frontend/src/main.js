import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import ElementPlus from "element-plus";
import ru from "element-plus/dist/locale/ru.mjs";
import "element-plus/dist/index.css";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

(async () => {
  const auth = useAuthStore(pinia);
  await auth.bootstrap();

  app.use(router);
  app.use(ElementPlus, { locale: ru });
  app.mount("#app");
})();
