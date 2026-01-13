<template>
  <div class="cards-list">
    <slot />
  </div>
</template>

<style scoped>
.cards-list {
  display: grid;
  gap: var(--gap-md);
  /* Force 3 columns on larger screens as requested */
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1100px) {
  .cards-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .cards-list {
    grid-template-columns: 1fr;
  }
}
</style>
