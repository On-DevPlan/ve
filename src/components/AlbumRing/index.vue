<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const ALBUMS = [
  { title: 'Midnights', cover: 'https://picsum.photos/seed/a1/260/160' },
  { title: 'Dawn FM', cover: 'https://picsum.photos/seed/a2/260/160' },
  { title: 'Renaissance', cover: 'https://picsum.photos/seed/a3/260/160' },
  { title: 'SOS', cover: 'https://picsum.photos/seed/a4/260/160' },
  { title: '30', cover: 'https://picsum.photos/seed/a5/260/160' },
  { title: "Harry's House", cover: 'https://picsum.photos/seed/a6/260/160' },
  { title: 'Un Verano', cover: 'https://picsum.photos/seed/a7/260/160' },
  { title: 'Motomami', cover: 'https://picsum.photos/seed/a8/260/160' },
  { title: 'Mr. Morale', cover: 'https://picsum.photos/seed/a9/260/160' },
  { title: 'Gemini Rights', cover: 'https://picsum.photos/seed/a10/260/160' },
]

const CARD_COUNT = ALBUMS.length
const RADIUS = 380
const STEP = 360 / CARD_COUNT

const currentAngle = ref(0)
let targetAngle = 0
let rafId = 0
const hoveredIdx = ref<number | null>(null)

const cardStyles = computed(() =>
  ALBUMS.map((_, i) => ({
    '--rx': `${i * STEP}deg`,
    transform: `rotateX(var(--rx)) translateZ(${RADIUS}px)`,
  }))
)

const ringTransform = computed(() =>
  `rotateX(${currentAngle.value}deg)`
)

function animate() {
  const diff = targetAngle - currentAngle.value
  if (Math.abs(diff) > 0.05) {
    currentAngle.value += diff * 0.1
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
      <div class="scene">
        <div class="ring" :style="{ transform: ringTransform }">
          <div
            v-for="(album, i) in ALBUMS"
            :key="i"
            class="card"
            :class="{ hovered: hoveredIdx === i }"
            :style="cardStyles[i]"
            @mouseenter="hoveredIdx = i"
            @mouseleave="hoveredIdx = null"
          >
            <img :src="album.cover" :alt="album.title" />
            <span class="label">{{ album.title }}</span>
          </div>
        </div>
      </div>
    </div>
    <p class="hint">&#8596; Scroll to rotate</p>
  </div>
</template>

<style scoped>
.album-ring-app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 100%);
}

.viewport {
  width: 700px;
  height: 360px;
  overflow: hidden;
  position: relative;
}

.scene {
  width: 100%;
  height: 760px;
  position: absolute;
  top: 0;
  perspective: 1200px;
  perspective-origin: 50% 50%;
}

.ring {
  width: 100%;
  height: 100%;
  position: absolute;
  transform-style: preserve-3d;
}

.card {
  position: absolute;
  width: 260px;
  height: 160px;
  left: 50%;
  top: 50%;
  margin-left: -130px;
  margin-top: -80px;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              box-shadow 0.35s ease,
              border-color 0.35s ease;
}

.card.hovered {
  transform: rotateX(var(--rx)) translateZ(420px) scale(1.12) !important;
  box-shadow:
    0 0 40px rgba(99, 102, 241, 0.4),
    0 0 80px rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.5);
  z-index: 10;
}

.card img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 16px;
  opacity: 0.7;
  transition: opacity 0.35s ease;
}

.card.hovered img {
  opacity: 1;
}

.label {
  position: relative;
  z-index: 1;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
  letter-spacing: 1px;
  transition: transform 0.35s ease;
}

.card.hovered .label {
  transform: translateY(-4px) scale(1.05);
}

.hint {
  text-align: center;
  color: #555;
  font-size: 13px;
  margin-top: 16px;
  font-family: system-ui, -apple-system, sans-serif;
}
</style>
