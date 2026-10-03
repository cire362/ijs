import type { Directive } from 'vue'

// Fades sections in once they enter the viewport. CSS keeps them static under reduced motion.
let observer: IntersectionObserver | null = null

function getObserver () {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      observer?.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 })
  return observer
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted (el, binding) {
    el.dataset.reveal = ''
    if (binding.value) el.style.setProperty('--reveal-index', String(binding.value))
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return }
    getObserver().observe(el)
  },
  unmounted (el) {
    observer?.unobserve(el)
  }
}
