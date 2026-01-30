import { createRouter, createWebHistory } from "vue-router";
import PropertiesView from "../views/PropertiesView.vue";
import PropertyDetailsView from "../views/PropertyDetailsView.vue";
import ApplicationsView from "../views/ApplicationsView.vue";
import LoginView from "../views/LoginView.vue";
import IncomingView from "../views/IncomingView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import ProfileView from "../views/ProfileView.vue";
import ApplicationChatsView from "../views/ApplicationChatsView.vue";
import NewsView from "../views/NewsView.vue";
import NewsDetailsView from "../views/NewsDetailsView.vue";
import EventsView from "../views/EventsView.vue";
import ShowcaseView from "../views/ShowcaseView.vue";
import PrivacyView from "../views/PrivacyView.vue";
import TermsView from "../views/TermsView.vue";
import AdminChatView from "../views/AdminChatView.vue";
import TariffsView from "../views/TariffsView.vue";
import { useAuthStore } from "../stores/auth";

const routes = [
  { path: "/", component: ShowcaseView },
  { path: "/privacy", component: PrivacyView },
  { path: "/terms", component: TermsView },
  {
    path: "/properties",
    component: PropertiesView,
    meta: { requiresAuth: true },
  },
  {
    path: "/properties/:id",
    component: PropertyDetailsView,
    meta: { requiresAuth: true },
  },
  { path: "/news", component: NewsView },
  { path: "/news/:id", component: NewsDetailsView },
  { path: "/events", component: EventsView },
  {
    path: "/applications",
    component: ApplicationsView,
    meta: { requiresAuth: true, roles: ["agent"] },
  },
  {
    path: "/application-chats",
    component: ApplicationChatsView,
    meta: { requiresAuth: true, roles: ["agent", "admin"] },
  },
  {
    path: "/incoming",
    component: IncomingView,
    meta: { requiresAuth: true, roles: ["developer", "admin"] },
  },
  {
    path: "/admin/chat",
    component: AdminChatView,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
  {
    path: "/tariffs",
    component: TariffsView,
    meta: { requiresAuth: true },
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
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: "smooth",
      };
    }
    return savedPosition || { top: 0 };
  },
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
