<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useSupportStore } from "@/stores/support";
import {
  Place,
  Check,
  ArrowRight,
  Memo,
  ChatDotRound,
  User,
  QuestionFilled,
  ArrowDown,
} from "@element-plus/icons-vue";

const router = useRouter();
const auth = useAuthStore();
const supportStore = useSupportStore();

import { onMounted } from "vue";

const stats = ref([
  { value: 0, target: 1500, suffix: "+", label: "Активных агентов" },
  { value: 0, target: 40000, suffix: "", label: "Квартир в базе" },
  { value: 0, target: 120, suffix: "", label: "Жилых комплексов" },
  { value: 24, target: 24, suffix: "/7", label: "Поддержка", isStatic: true },
]);

// Simple easing function
const easeOutQuad = (t) => t * (2 - t);

const runStatsAnimation = () => {
  const duration = 2000;
  const frameDuration = 1000 / 60;
  const totalFrames = Math.round(duration / frameDuration);
  let frame = 0;

  const timer = setInterval(() => {
    frame++;
    const progress = easeOutQuad(frame / totalFrames);

    stats.value.forEach((stat) => {
      if (!stat.isStatic) {
        stat.value = Math.floor(stat.target * progress);
      }
    });

    if (frame === totalFrames) {
      clearInterval(timer);
    }
  }, frameDuration);
};

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        runStatsAnimation();
        observer.disconnect();
      }
    });
  });

  const statsEl = document.getElementById("stats-section");
  if (statsEl) observer.observe(statsEl);
});

const faqs = ref([
  {
    question: "Как начать работу с платформой?",
    answer:
      "Просто зарегистрируйтесь как агент или застройщик. После подтверждения аккаунта вам станет доступен полный каталог объектов и инструментов.",
    open: false,
  },
  {
    question: "Нужно ли платить за использование?",
    answer:
      "Базовый функционал поиска и бронирования бесплатен для агентов. Мы берем комиссию только за успешные сделки.",
    open: false,
  },
  {
    question: "Как быстро проходят выплаты?",
    answer:
      "Мы проводим выплаты в день закрытия сделки и получения средств от застройщика.",
    open: false,
  },
  {
    question: "Могу ли я работать как ИП или самозанятый?",
    answer: "Да, мы работаем со всеми формами юридических лиц и самозанятыми.",
    open: false,
  },
]);

const toggleFaq = (index) => {
  faqs.value[index].open = !faqs.value[index].open;
};

const scrollTo = (id) => {
  const el = document.getElementById(id);
  if (el) {
    const headerOffset = 100;
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }
};
</script>

<template>
  <div class="landing-page font-sans text-gray-800 bg-[#F9F9F9]">
    <!-- Navbar -->
    <nav
      class="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 py-4"
    >
      <div
        class="container mx-auto px-4 md:px-8 flex justify-between items-center"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 bg-accent rounded-lg flex items-center justify-center"
          >
            <span class="font-bold text-white text-xl">I</span>
          </div>
          <span class="font-bold text-xl tracking-tight text-gray-900"
            >IJSHub</span
          >
        </div>
        <div class="hidden md:flex items-center gap-8 font-medium text-sm">
          <a
            href="#"
            @click.prevent="scrollTo('features')"
            class="hover:text-accent transition"
            >Возможности</a
          >
          <a
            href="#"
            @click.prevent="scrollTo('how-it-works')"
            class="hover:text-accent transition"
            >Как это работает</a
          >
          <a
            href="#"
            @click.prevent="scrollTo('faq')"
            class="hover:text-accent transition"
            >FAQ</a
          >
        </div>
        <div class="flex items-center gap-4" v-if="!auth.user">
          <router-link
            to="/login"
            class="text-sm font-medium hover:text-accent transition hidden sm:block"
            >Вход</router-link
          >
          <button
            @click="router.push('/login?tab=register')"
            class="bg-accent hover:bg-yellow-500 text-black font-semibold py-2.5 px-6 rounded-xl transition shadow-lg shadow-yellow-500/20 text-sm"
          >
            Регистрация
          </button>
        </div>
        <div class="flex items-center gap-4" v-else>
          <el-dropdown trigger="click">
            <span
              class="flex items-center gap-2 cursor-pointer font-medium hover:text-accent transition"
            >
              <el-avatar :size="32" :src="auth.user.avatarUrl">{{
                auth.user.name?.[0] || auth.user.email?.[0]
              }}</el-avatar>
              <span class="hidden sm:inline-block">{{
                auth.user.name || auth.user.email
              }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/properties')"
                  >Каталог</el-dropdown-item
                >
                <el-dropdown-item
                  v-if="auth.user.role === 'admin'"
                  @click="router.push('/admin/chat')"
                  >Поддержка</el-dropdown-item
                >
                <el-dropdown-item @click="auth.logout()"
                  >Выйти</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
      <div class="container mx-auto px-4 md:px-8">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <div class="space-y-8 max-w-2xl relative z-10">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-500 shadow-sm"
            >
              <span class="block w-2 h-2 rounded-full bg-accent"></span>
              Платформа уже доступна
            </div>
            <h1
              class="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-gray-900"
            >
              Цифровая экосистема <br />
              <span
                class="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500"
                >для профессионалов</span
              >
              рынка недвижимости
            </h1>
            <p
              class="text-lg md:text-xl text-gray-500 leading-relaxed max-w-lg"
            >
              Единое пространство для застройщиков и агентов. Управляйте
              объектами, заявками и сделками в одном окне.
            </p>
            <div class="flex flex-col sm:flex-row gap-4">
              <button
                v-if="!auth.user"
                @click="router.push('/login?tab=register')"
                class="bg-accent hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl transition transform hover:-translate-y-1 shadow-xl shadow-yellow-500/30 text-center"
              >
                Начать бесплатно
              </button>
              <button
                v-else
                @click="router.push('/properties')"
                class="bg-accent hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl transition transform hover:-translate-y-1 shadow-xl shadow-yellow-500/30 text-center"
              >
                Перейти в каталог
              </button>
            </div>

            <div
              class="pt-8 flex items-center gap-8 text-sm font-medium text-gray-400"
            >
              <div class="flex items-center gap-2">
                <el-icon class="text-accent"><Check /></el-icon>
                <span>Без абонентской платы</span>
              </div>
              <div class="flex items-center gap-2">
                <el-icon class="text-accent"><Check /></el-icon>
                <span>Быстрые выплаты</span>
              </div>
            </div>
          </div>

          <div class="relative lg:h-[600px] flex items-center justify-center">
            <!-- Mockup Placeholder -->
            <div class="relative z-10 w-full max-w-md mx-auto">
              <div
                class="bg-white rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] p-4 border border-gray-100 relative"
              >
                <!-- Mock UI header -->
                <div
                  class="h-6 w-32 bg-gray-100 rounded-full mb-4 mx-auto"
                ></div>
                <div class="space-y-4">
                  <div class="p-4 bg-gray-50 rounded-2xl flex gap-4">
                    <div class="w-16 h-16 bg-gray-200 rounded-xl"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 w-3/4 bg-gray-200 rounded"></div>
                      <div class="h-3 w-1/2 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div class="p-4 bg-gray-50 rounded-2xl flex gap-4">
                    <div class="w-16 h-16 bg-gray-200 rounded-xl"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 w-3/4 bg-gray-200 rounded"></div>
                      <div class="h-3 w-1/2 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div
                    class="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex gap-4 items-center"
                  >
                    <div
                      class="w-10 h-10 rounded-full bg-accent flex items-center justify-center"
                    >
                      <el-icon class="text-black font-bold"><Check /></el-icon>
                    </div>
                    <div>
                      <div class="font-bold text-gray-900">Сделка закрыта</div>
                      <div class="text-xs text-gray-500">
                        + 150 000 ₽ комиссия
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Floating elements -->
              <div
                class="absolute -right-8 top-20 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 animate-float"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600"
                  >
                    <el-icon><User /></el-icon>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400">Новый агент</p>
                    <p class="font-bold text-sm">Алексей П.</p>
                  </div>
                </div>
              </div>

              <div
                class="absolute -left-4 bottom-32 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 animate-float-delayed"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
                  >
                    <el-icon><Memo /></el-icon>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400">Новая заявка</p>
                    <p class="font-bold text-sm">ЖК «Современник»</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bg blobs -->
            <div
              class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-yellow-200/40 to-orange-100/40 rounded-full blur-3xl -z-0"
            ></div>
          </div>
        </div>

        <!-- Stats Strip -->
        <div
          id="stats-section"
          class="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-gray-200 pt-12"
        >
          <div v-for="(stat, i) in stats" :key="i">
            <p class="text-4xl font-extrabold text-gray-900 tabular-nums">
              {{ stat.value.toLocaleString() }}{{ stat.suffix }}
            </p>
            <p class="text-gray-500 mt-1">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section id="features" class="py-20 bg-white">
      <div class="container mx-auto px-4 md:px-8 max-w-6xl">
        <div class="text-center mb-16 max-w-2xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Инструменты для роста ваших продаж
          </h2>
          <p class="text-gray-500 text-lg">
            Мы создали платформу, которая берет на себя рутину, чтобы вы могли
            сосредоточиться на работе с клиентами.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div
            class="bg-[#F9F9F9] p-8 rounded-[24px] hover:shadow-lg transition group"
          >
            <div
              class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition text-2xl"
            >
              ⚡️
            </div>
            <h3 class="text-xl font-bold mb-3">Быстрый поиск</h3>
            <p class="text-gray-500 leading-relaxed">
              Удобные фильтры по району, цене и сроку сдачи. Подборки для
              клиентов за 1 минуту.
            </p>
          </div>
          <div
            class="bg-[#F9F9F9] p-8 rounded-[24px] hover:shadow-lg transition group"
          >
            <div
              class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition text-2xl"
            >
              📅
            </div>
            <h3 class="text-xl font-bold mb-3">Календарь событий</h3>
            <p class="text-gray-500 leading-relaxed">
              Запись на брокер-туры и обучение от застройщиков прямо в
              приложении.
            </p>
          </div>
          <div
            class="bg-[#F9F9F9] p-8 rounded-[24px] hover:shadow-lg transition group"
          >
            <div
              class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition text-2xl"
            >
              👛
            </div>
            <h3 class="text-xl font-bold mb-3">Прозрачные выплаты</h3>
            <p class="text-gray-500 leading-relaxed">
              Отслеживайте статусы сделок и получайте комиссию без задержек.
            </p>
          </div>
          <div
            class="bg-[#F9F9F9] p-8 rounded-[24px] hover:shadow-lg transition group md:col-span-2 lg:col-span-2"
          >
            <div
              class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition text-2xl"
            >
              🔒
            </div>
            <h3 class="text-xl font-bold mb-3">Безопасность</h3>
            <p class="text-gray-500 leading-relaxed">
              Защита данных ваших клиентов и гарантия фиксации уникальности
              заявки.
            </p>
          </div>
          <div
            class="bg-[#F9F9F9] p-8 rounded-[24px] hover:shadow-lg transition group"
          >
            <div
              class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition text-2xl"
            >
              🎓
            </div>
            <h3 class="text-xl font-bold mb-3">Обучение</h3>
            <p class="text-gray-500 leading-relaxed">
              База знаний, вебинары и новости рынка для повышения вашей
              квалификации.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works (Steps) -->
    <section id="how-it-works" class="py-20 bg-[#F9F9F9] overflow-hidden">
      <div class="container mx-auto px-4 md:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900">
            Как это работает
          </h2>
        </div>

        <div class="relative max-w-5xl mx-auto">
          <!-- Steps Line (Desktop) -->
          <div
            class="hidden lg:block absolute top-12 left-0 w-full h-0.5 bg-gray-200 -z-0"
          ></div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <!-- Step 1 -->
            <div
              class="relative bg-white p-8 pt-12 rounded-[24px] shadow-sm z-10 text-center lg:text-left"
            >
              <div
                class="w-12 h-12 bg-accent text-black font-bold text-xl rounded-xl flex items-center justify-center absolute -top-6 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 shadow-lg shadow-yellow-500/20"
              >
                1
              </div>
              <h4 class="font-bold text-lg mb-2 mt-4">Регистрация</h4>
              <p class="text-gray-500 text-sm">
                Создайте аккаунт и заполните профиль агента.
              </p>
            </div>
            <!-- Step 2 -->
            <div
              class="relative bg-white p-8 pt-12 rounded-[24px] shadow-sm z-10 text-center lg:text-left"
            >
              <div
                class="w-12 h-12 bg-accent text-black font-bold text-xl rounded-xl flex items-center justify-center absolute -top-6 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 shadow-lg shadow-yellow-500/20"
              >
                2
              </div>
              <h4 class="font-bold text-lg mb-2 mt-4">Поиск объекта</h4>
              <p class="text-gray-500 text-sm">
                Используйте фильтры для подбора идеального варианта.
              </p>
            </div>
            <!-- Step 3 -->
            <div
              class="relative bg-white p-8 pt-12 rounded-[24px] shadow-sm z-10 text-center lg:text-left"
            >
              <div
                class="w-12 h-12 bg-accent text-black font-bold text-xl rounded-xl flex items-center justify-center absolute -top-6 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 shadow-lg shadow-yellow-500/20"
              >
                3
              </div>
              <h4 class="font-bold text-lg mb-2 mt-4">Бронь</h4>
              <p class="text-gray-500 text-sm">
                Фиксируйте клиента за собой и отправляйте заявку.
              </p>
            </div>
            <!-- Step 4 -->
            <div
              class="relative bg-white p-8 pt-12 rounded-[24px] shadow-sm z-10 text-center lg:text-left"
            >
              <div
                class="w-12 h-12 bg-accent text-black font-bold text-xl rounded-xl flex items-center justify-center absolute -top-6 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 shadow-lg shadow-yellow-500/20"
              >
                4
              </div>
              <h4 class="font-bold text-lg mb-2 mt-4">Сделка</h4>
              <p class="text-gray-500 text-sm">
                Сопровождайте клиента и получайте комиссию.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Product Feature 1 -->
    <section class="py-20 bg-white">
      <div class="container mx-auto px-4 md:px-8 max-w-6xl">
        <div class="grid lg:grid-cols-2 gap-16 items-center">
          <div class="order-2 lg:order-1">
            <div class="bg-gray-100 rounded-[32px] p-8 md:p-12">
              <!-- Placeholder UI -->
              <div class="bg-white rounded-2xl shadow-lg p-6 max-w-sm mx-auto">
                <div class="flex justify-between items-center mb-6">
                  <div class="font-bold text-lg">Мои заявки</div>
                  <div class="text-accent">Все</div>
                </div>
                <div class="space-y-3">
                  <div
                    class="p-3 border border-gray-100 rounded-xl flex justify-between items-center"
                  >
                    <div>
                      <div class="font-medium text-sm">Иванов И.И.</div>
                      <div class="text-xs text-gray-400">ЖК "Приморский"</div>
                    </div>
                    <span
                      class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-lg"
                      >В работе</span
                    >
                  </div>
                  <div
                    class="p-3 border border-gray-100 rounded-xl flex justify-between items-center"
                  >
                    <div>
                      <div class="font-medium text-sm">Петрова А.С.</div>
                      <div class="text-xs text-gray-400">ЖК "Северный"</div>
                    </div>
                    <span
                      class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg"
                      >Одобрено</span
                    >
                  </div>
                  <div
                    class="p-3 border border-gray-100 rounded-xl flex justify-between items-center opacity-60"
                  >
                    <div>
                      <div class="font-medium text-sm">Сидоров К.К.</div>
                      <div class="text-xs text-gray-400">ЖК "Центральный"</div>
                    </div>
                    <span
                      class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg"
                      >Закрыто</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="order-1 lg:order-2 space-y-6">
            <div
              class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-2xl mb-4"
            >
              📂
            </div>
            <h2 class="text-3xl md:text-4xl font-bold text-gray-900">
              Полный контроль над заявками
            </h2>
            <p class="text-gray-500 text-lg leading-relaxed">
              Забудьте про Excel и блокноты. Все ваши клиенты, статусы и история
              взаимодействий собраны в удобном CRM-интерфейсе.
            </p>
            <ul class="space-y-4 pt-4">
              <li class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs"
                >
                  <el-icon><Check /></el-icon>
                </div>
                <span class="font-medium">История изменений статусов</span>
              </li>
              <li class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs"
                >
                  <el-icon><Check /></el-icon>
                </div>
                <span class="font-medium">Комментарии к заявкам</span>
              </li>
              <li class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs"
                >
                  <el-icon><Check /></el-icon>
                </div>
                <span class="font-medium">Уведомления об обновлениях</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="py-20 bg-[#F9F9F9]">
      <div class="container mx-auto px-4 md:px-8 max-w-5xl">
        <div class="grid md:grid-cols-3 gap-12">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 mb-4">
              Частые вопросы
            </h2>
            <p class="text-gray-500 mb-8">
              Не нашли ответ? Напишите нам в поддержку.
            </p>
            <button
              @click="supportStore.open()"
              class="bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 font-bold py-3 px-6 rounded-xl transition shadow-sm flex items-center gap-2"
            >
              <el-icon><ChatDotRound /></el-icon> Написать в чат
            </button>
          </div>
          <div class="md:col-span-2 space-y-4">
            <div
              v-for="(item, idx) in faqs"
              :key="idx"
              class="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              <button
                @click="toggleFaq(idx)"
                class="w-full flex justify-between items-center p-6 text-left hover:bg-gray-50 transition"
              >
                <span class="font-bold text-gray-900">{{ item.question }}</span>
                <div
                  class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-transform duration-300"
                  :class="{ 'rotate-180': item.open }"
                >
                  <el-icon class="text-gray-500 font-bold text-xs"
                    ><ArrowRight class="transform rotate-90"
                  /></el-icon>
                </div>
              </button>
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-out"
                :class="item.open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
              >
                <div class="overflow-hidden">
                  <div
                    class="px-6 pb-6 text-gray-500 leading-relaxed text-sm bg-gray-50/50 pt-2 border-t border-gray-50"
                  >
                    {{ item.answer }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Block (formerly part of footer) -->
    <section class="bg-[#1A1A1A] text-white py-20 rounded-t-[40px] mt-10">
      <div class="container mx-auto px-4 md:px-8">
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 class="text-3xl md:text-4xl font-bold mb-6">
              Готовы начать зарабатывать больше?
            </h2>
            <p class="text-gray-400 text-lg mb-8">
              Присоединяйтесь к сообществу профессионалов уже сегодня.
            </p>
            <button
              v-if="!auth.user"
              @click="router.push('/login?tab=register')"
              class="bg-accent hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl transition shadow-lg shadow-yellow-500/20"
            >
              Зарегистрироваться бесплатно
            </button>
            <button
              v-else
              @click="router.push('/properties')"
              class="bg-accent hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl transition shadow-lg shadow-yellow-500/20"
            >
              Перейти в каталог
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Custom Accent Color Override */
.bg-accent {
  background-color: #ffcc00;
}
.text-accent {
  color: #fdd835;
}
.border-accent {
  border-color: #ffcc00;
}

/* Animations */
@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}

@keyframes float-delayed {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
  100% {
    transform: translateY(0px);
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float-delayed 5s ease-in-out infinite 2s;
}
</style>
