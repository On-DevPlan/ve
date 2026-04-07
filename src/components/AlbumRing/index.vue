<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const ALBUMS = [
  { title: 'Midnights', cover: 'https://picsum.photos/seed/r1/220/300' },
  { title: 'Dawn FM', cover: 'https://picsum.photos/seed/r2/220/300' },
  { title: 'Renaissance', cover: 'https://picsum.photos/seed/r3/220/300' },
  { title: 'SOS', cover: 'https://picsum.photos/seed/r4/220/300' },
  { title: '30', cover: 'https://picsum.photos/seed/r5/220/300' },
  { title: "Harry's House", cover: 'https://picsum.photos/seed/r6/220/300' },
  { title: 'Un Verano', cover: 'https://picsum.photos/seed/r7/220/300' },
  { title: 'Motomami', cover: 'https://picsum.photos/seed/r8/220/300' },
  { title: 'Mr. Morale', cover: 'https://picsum.photos/seed/r9/220/300' },
  { title: 'Gemini Rights', cover: 'https://picsum.photos/seed/r10/220/300' },
  { title: 'Starboy', cover: 'https://picsum.photos/seed/r11/220/300' },
  { title: 'Blinding', cover: 'https://picsum.photos/seed/r12/220/300' },
]

const COUNT = ALBUMS.length
const RING_RADIUS = 180
const ARC_START = -75
const ARC_END = 75
const ARC_RANGE = ARC_END - ARC_START
const STEP = ARC_RANGE / (COUNT - 1)
const CENTER_X = 240
const CENTER_Y = 260

const currentAngle = ref(0)
let targetAngle = 0
let rafId = 0
const hoveredIdx = ref<number | null>(null)

const cardStyles = computed(() =>
  ALBUMS.map((_, i) => {
    const baseAngle = ARC_START + i * STEP
    const angleDeg = baseAngle + currentAngle.value
    const angleRad = (angleDeg * Math.PI) / 180

    const x = CENTER_X + RING_RADIUS * Math.sin(angleRad) - 36
    const y = CENTER_Y - RING_RADIUS * Math.cos(angleRad) - 48

    const normalizedAngle = ((angleDeg + 180) % 360) - 180
    const absAngle = Math.abs(normalizedAngle)
    const opacity = absAngle > 90 ? 0 : Math.max(0.3, 1 - absAngle / 90)
    const pointerEvents = absAngle > 100 ? 'none' : 'auto'
    const zIndex = Math.round(100 - absAngle)

    return {
      left: `${x}px`,
      top: `${y}px`,
      opacity,
      pointerEvents,
      zIndex,
    }
  })
)

function animate() {
  const diff = targetAngle - currentAngle.value
  if (Math.abs(diff) > 0.02) {
    currentAngle.value += diff * 0.08
  } else {
    currentAngle.value = targetAngle
  }
  rafId = requestAnimationFrame(animate)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  targetAngle += e.deltaY * 0.15
}

onMounted(() => {
  rafId = requestAnimationFrame(animate)
  window.addEventListener('wheel', onWheel, { passive: false })
})
onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('wheel', onWheel)
})
</script>

<template>
  <div class="album-ring-app">
    <div class="viewport">
      <svg class="semicircle-track" viewBox="0 0 480 200" preserveAspectRatio="none">
        <path
          d="M 60 200 A 180 180 0 0 1 420 200"
          fill="none"
          stroke="rgba(139, 92, 246, 0.1)"
          stroke-width="1"
          stroke-dasharray="4 6"
        />
      </svg>

      <div
        v-for="(album, i) in ALBUMS"
        :key="i"
        class="card"
        :class="{ hovered: hoveredIdx === i }"
        :style="cardStyles[i]"
        @mouseenter="hoveredIdx = i"
        @mouseleave="hoveredIdx = null"
      >
        <img :src="album.cover" :alt="album.title" loading="lazy" />
        <div class="overlay">
          <span class="title">{{ album.title }}</span>
        </div>
      </div>
    </div>
    <p class="hint">&#8596; Scroll to rotate</p>
  </div>
</template>

<style scoped>
.album-ring-app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  position: relative;
}

.viewport {
  width: 480px;
  height: 300px;
  overflow: hidden;
  position: relative;
  border-radius: 16px;
  background: #0a0a12;
  border: 1px solid rgba(139, 92, 246, 0.12);
  box-shadow: 0 0 60px rgba(139, 92, 246, 0.08);
}

.semicircle-track {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 180px;
  pointer-events: none;
}

.card {
  position: absolute;
  width: 72px;
  height: 96px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition:
    transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    box-shadow 0.35s ease,
    border-color 0.35s ease;
}

.card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease, filter 0.35s ease;
  filter: brightness(0.75);
}

.overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 2px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  transform: translateY(100%);
  transition: transform 0.3s ease;
}

.title {
  color: #fff;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.2px;
  display: block;
  text-align: center;
}

.card.hovered {
  box-shadow:
    0 0 24px rgba(139, 92, 246, 0.45),
    0 0 48px rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.4);
  transform: scale(1.12);
  z-index: 100 !important;
}

.card.hovered img {
  transform: scale(1.06);
  filter: brightness(1);
}

.card.hovered .overlay {
  transform: translateY(0);
}

.hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: #444;
  font-size: 11px;
  font-family: system-ui, sans-serif;
}
</style>
