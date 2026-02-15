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
import LegalDocumentsView from "../views/LegalDocumentsView.vue";
import AdminChatView from "../views/AdminChatView.vue";
import TariffsView from "../views/TariffsView.vue";
import { useAuthStore } from "../stores/auth";

const routes = [
  {
    path: "/",
    component: ShowcaseView,
    meta: {
      title: "ИЖС — платформа для подбора объектов",
      description:
        "ИЖС — платформа для подбора объектов, заявок, новостей и событий.",
      ogType: "website",
    },
  },
  {
    path: "/legal",
    component: LegalDocumentsView,
    meta: {
      title: "Правовые документы — ИЖС",
      description: "Правовые документы и условия использования сервиса ИЖС.",
    },
  },
  {
    path: "/privacy",
    redirect: { path: "/legal", query: { tab: "privacy" } },
  },
  {
    path: "/terms",
    redirect: { path: "/legal", query: { tab: "terms" } },
  },
  {
    path: "/properties",
    component: PropertiesView,
    meta: {
      requiresAuth: true,
      title: "Объекты — ИЖС",
      description: "Список объектов в личном кабинете ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/properties/:id",
    component: PropertyDetailsView,
    meta: {
      requiresAuth: true,
      title: "Объект — ИЖС",
      description: "Карточка объекта в личном кабинете ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/news",
    component: NewsView,
    meta: {
      title: "Новости — ИЖС",
      description: "Новости сервиса ИЖС.",
    },
  },
  {
    path: "/news/:id",
    component: NewsDetailsView,
    meta: {
      title: "Новость — ИЖС",
      description: "Подробности новости сервиса ИЖС.",
    },
  },
  {
    path: "/events",
    component: EventsView,
    meta: {
      title: "События — ИЖС",
      description: "События и мероприятия сервиса ИЖС.",
    },
  },
  {
    path: "/applications",
    component: ApplicationsView,
    meta: {
      requiresAuth: true,
      roles: ["agent"],
      title: "Мои заявки — ИЖС",
      description: "Управление заявками в личном кабинете агента ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/application-chats",
    component: ApplicationChatsView,
    meta: {
      requiresAuth: true,
      roles: ["agent", "admin"],
      title: "Чаты по заявкам — ИЖС",
      description: "Общение по заявкам в личном кабинете ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/incoming",
    component: IncomingView,
    meta: {
      requiresAuth: true,
      roles: ["developer", "admin"],
      title: "Входящие — ИЖС",
      description: "Входящие обращения в личном кабинете ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/admin/chat",
    component: AdminChatView,
    meta: {
      requiresAuth: true,
      roles: ["admin"],
      title: "Админ-чат — ИЖС",
      description: "Административный чат ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/tariffs",
    component: TariffsView,
    meta: {
      requiresAuth: true,
      title: "Тарифы — ИЖС",
      description: "Тарифы и условия сервиса ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/notifications",
    component: NotificationsView,
    meta: {
      requiresAuth: true,
      title: "Уведомления — ИЖС",
      description: "Уведомления пользователя в личном кабинете ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/profile",
    component: ProfileView,
    meta: {
      requiresAuth: true,
      title: "Профиль — ИЖС",
      description: "Профиль пользователя в личном кабинете ИЖС.",
      robots: "noindex,nofollow",
    },
  },
  {
    path: "/login",
    component: LoginView,
    meta: {
      title: "Вход — ИЖС",
      description: "Вход в личный кабинет ИЖС.",
      robots: "noindex,nofollow",
    },
  },
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

const DEFAULT_META = {
  title: "ИЖС",
  description: "ИЖС — сервис для подбора объектов, заявок, новостей и событий.",
  robots: "index,follow",
  ogType: "website",
  siteName: "ИЖС",
};

function setMetaTag({ name, property, content }) {
  const selector = name
    ? `meta[name="${name}"]`
    : `meta[property="${property}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    if (name) el.setAttribute("name", name);
    if (property) el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url || "/");
}

router.afterEach((to) => {
  const title = to.meta?.title || DEFAULT_META.title;
  const description = to.meta?.description || DEFAULT_META.description;
  const robots = to.meta?.robots || DEFAULT_META.robots;
  const ogType = to.meta?.ogType || DEFAULT_META.ogType;

  document.title = title;

  setMetaTag({ name: "description", content: description });
  setMetaTag({ name: "robots", content: robots });

  setMetaTag({ property: "og:site_name", content: DEFAULT_META.siteName });
  setMetaTag({ property: "og:type", content: ogType });
  setMetaTag({ property: "og:title", content: title });
  setMetaTag({ property: "og:description", content: description });
  setMetaTag({ property: "og:url", content: window.location.href });

  setMetaTag({ name: "twitter:card", content: "summary_large_image" });
  setMetaTag({ name: "twitter:title", content: title });
  setMetaTag({ name: "twitter:description", content: description });

  setCanonical(window.location.href);
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
