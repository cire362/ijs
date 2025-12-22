import { createRouter, createWebHistory } from "vue-router";
import PropertiesView from "../views/PropertiesView.vue";
import PropertyDetailsView from "../views/PropertyDetailsView.vue";
import ApplicationsView from "../views/ApplicationsView.vue";
import LoginView from "../views/LoginView.vue";
import IncomingView from "../views/IncomingView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import ProfileView from "../views/ProfileView.vue";
import NewsView from "../views/NewsView.vue";
import NewsDetailsView from "../views/NewsDetailsView.vue";
import EventsView from "../views/EventsView.vue";
import { useAuthStore } from "../stores/auth";

const routes = [
  { path: "/", redirect: "/properties" },
  { path: "/properties", component: PropertiesView },
  { path: "/properties/:id", component: PropertyDetailsView },
  { path: "/news", component: NewsView },
  { path: "/news/:id", component: NewsDetailsView },
  { path: "/events", component: EventsView },
  {
    path: "/applications",
    component: ApplicationsView,
    meta: { requiresAuth: true, roles: ["agent"] },
  },
  {
    path: "/incoming",
    component: IncomingView,
    meta: { requiresAuth: true, roles: ["developer", "admin"] },
  },
  {
    path: "/notifications",
    component: NotificationsView,
    meta: { requiresAuth: true },
  },
  { path: "/profile", component: ProfileView, meta: { requiresAuth: true } },
  { path: "/login", component: LoginView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.path === "/login" && auth.user) {
    return { path: "/properties" };
  }

  if (to.meta?.requiresAuth && !auth.user) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  const roles = to.meta?.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    const role = auth.user?.role;
    if (!role || !roles.includes(role)) {
      return { path: "/properties" };
    }
  }

  return true;
});

export default router;
