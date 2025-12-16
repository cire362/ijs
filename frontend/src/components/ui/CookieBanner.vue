<template>
  <transition name="fade">
    <div v-if="visible" class="banner card-shadow">
      <div>
        <div class="title">Мы бережно храним данные</div>
        <div class="muted">
          Продолжая, вы принимаете cookies и соглашение о персональных данных.
        </div>
      </div>
      <div class="actions">
        <el-button size="small" type="info" text @click="dismiss"
          >Позже</el-button
        >
        <el-button size="small" type="warning" @click="accept"
          >Согласен</el-button
        >
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from "vue";

const visible = ref(true);

function accept() {
  visible.value = false;
}
function dismiss() {
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
