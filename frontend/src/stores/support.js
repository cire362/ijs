import { defineStore } from "pinia";

export const useSupportStore = defineStore("support", {
  state: () => ({
    isOpen: false,
    adminUnreadCount: 0,
  }),
  actions: {
    open() {
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
    },
    toggle() {
      this.isOpen = !this.isOpen;
    },
    setAdminUnreadCount(count) {
      this.adminUnreadCount = count;
    },
    incrementAdminUnreadCount() {
      this.adminUnreadCount++;
    },
    decrementAdminUnreadCount(amount = 1) {
      this.adminUnreadCount = Math.max(0, this.adminUnreadCount - amount);
    },
  },
});
