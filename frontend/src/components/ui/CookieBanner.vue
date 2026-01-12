<template>
  <transition name="fade">
    <div v-if="visible" class="banner card-shadow">
      <div>
        <div class="title">Мы используем файлы cookie</div>
        <div class="muted">
          Мы используем файлы cookie для работы сайта. Продолжая использование,
          вы соглашаетесь с
          <a href="/privacy" class="text-blue-500 hover:underline"
            >политикой конфиденциальности</a
          >.
        </div>
      </div>
      <div class="actions">
        <el-button size="small" type="primary" @click="accept">ОК</el-button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from "vue";

const visible = ref(false);

onMounted(() => {
  if (!localStorage.getItem("cookie_accepted")) {
    visible.value = true;
  }
});

function accept() {
  localStorage.setItem("cookie_accepted", "true");
  visible.value = false;
}
</script>

<style scoped>
.banner {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #fff;
  padding: var(--gap-md);
  border-radius: var(--radius);
  border: 1px solid #e5e5e5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-md);
  max-width: 420px;
}
.title {
  font-weight: 700;
  margin-bottom: 4px;
}
.actions {
  display: flex;
  gap: var(--gap-xs);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
