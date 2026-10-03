<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useThemeStore } from '@/stores/theme'

// Free vector tiles without an API key: https://openfreemap.org (MapLibre adds the required attribution).
const STYLES = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' }
const RUSSIA: [number, number] = [37.62, 55.75]
const LOCALE = {
  'AttributionControl.ToggleAttribution': 'Источники карты',
  'Map.Title': 'Карта',
  'Marker.Title': 'Участок',
  'NavigationControl.ZoomIn': 'Приблизить',
  'NavigationControl.ZoomOut': 'Отдалить',
  'CooperativeGesturesHandler.WindowsHelpText': 'Чтобы изменить масштаб, прокручивайте с зажатым Ctrl',
  'CooperativeGesturesHandler.MacHelpText': 'Чтобы изменить масштаб, прокручивайте с зажатым ⌘',
  'CooperativeGesturesHandler.MobileHelpText': 'Перемещайте карту двумя пальцами'
}

const props = withDefaults(defineProps<{ lat?: number | null, lng?: number | null, precision?: number | null, editable?: boolean }>(), {
  lat: null, lng: null, precision: null, editable: false
})
const emit = defineEmits<{ pick: [point: { lat: number, lng: number }] }>()

const theme = useThemeStore()
const container = ref<HTMLElement | null>(null)
const map = shallowRef<MapLibreMap | null>(null)
const failed = ref(false)
let marker: Marker | null = null
let maplibre: typeof import('maplibre-gl') | null = null
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function zoomFor (precision: number | null) {
  if (precision == null || precision <= 1) return 16
  return precision === 2 ? 14 : 12
}

// Labels in Russian where the tiles have them.
function russianLabels (instance: MapLibreMap) {
  for (const layer of instance.getStyle().layers ?? []) {
    if (layer.type === 'symbol' && instance.getLayoutProperty(layer.id, 'text-field')) {
      instance.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']])
    }
  }
}

function placeMarker (lng: number, lat: number) {
  if (!map.value || !maplibre) return
  if (!marker) {
    marker = new maplibre.Marker({ color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1a56a6', draggable: props.editable })
      .setLngLat([lng, lat])
      .addTo(map.value)
    marker.on('dragend', () => {
      const point = marker!.getLngLat()
      emit('pick', { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) })
    })
  } else {
    marker.setLngLat([lng, lat])
  }
}

onMounted(async () => {
  try {
    maplibre = await import('maplibre-gl')
    const workerUrl = (await import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')).default
    maplibre.setWorkerUrl(workerUrl)
    const hasPoint = props.lat != null && props.lng != null
    const instance = new maplibre.Map({
      container: container.value!,
      style: theme.isDark ? STYLES.dark : STYLES.light,
      center: hasPoint ? [props.lng!, props.lat!] : RUSSIA,
      zoom: hasPoint ? zoomFor(props.precision) : 3,
      attributionControl: { compact: true },
      locale: LOCALE,
      cooperativeGestures: !props.editable
    })
    instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
    instance.on('styledata', () => russianLabels(instance))
    if (props.editable) {
      instance.on('click', (event) => {
        placeMarker(event.lngLat.lng, event.lngLat.lat)
        emit('pick', { lat: Number(event.lngLat.lat.toFixed(6)), lng: Number(event.lngLat.lng.toFixed(6)) })
      })
    }
    map.value = instance
    if (hasPoint) placeMarker(props.lng!, props.lat!)
  } catch {
    failed.value = true
  }
})

watch(() => [props.lat, props.lng] as const, ([lat, lng]) => {
  if (!map.value || lat == null || lng == null) return
  placeMarker(lng, lat)
  map.value.easeTo({ center: [lng, lat], zoom: Math.max(map.value.getZoom(), zoomFor(props.precision)), duration: reduceMotion ? 0 : 600 })
})

watch(() => theme.isDark, (dark) => { map.value?.setStyle(dark ? STYLES.dark : STYLES.light) })

onBeforeUnmount(() => {
  marker?.remove()
  map.value?.remove()
})
</script>

<template>
  <div class="relative overflow-hidden rounded-surface bg-surface-2">
    <div ref="container" class="size-full" />
    <div v-if="failed" class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">Карта не загрузилась. Проверьте подключение к интернету.</div>
  </div>
</template>

<style>
/* Map controls follow the app theme; the attribution stays visible as the tile licence requires. */
.maplibregl-ctrl-attrib.maplibregl-compact { font-size: 11px; }
html.dark .maplibregl-ctrl-group,
html.dark .maplibregl-ctrl-attrib.maplibregl-compact,
html.dark .maplibregl-ctrl-attrib { background: var(--surface); color: var(--text-muted); }
html.dark .maplibregl-ctrl-attrib a { color: var(--text-muted); }
html.dark .maplibregl-ctrl-group button + button { border-top-color: var(--border); }
html.dark .maplibregl-ctrl button .maplibregl-ctrl-icon { filter: invert(1) brightness(0.9); }
html.dark .maplibregl-ctrl-attrib-button { filter: invert(1); }
.maplibregl-cooperative-gesture-screen { font-family: var(--font-sans); font-size: 15px; }
</style>
