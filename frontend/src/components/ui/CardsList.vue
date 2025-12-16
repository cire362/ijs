<template>
  <div class="cards-list">
    <slot />
  </div>
</template>

<style scoped>
.cards-list {
  display: grid;
  gap: var(--gap-md);
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
</style>
