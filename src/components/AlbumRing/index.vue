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
const RADIUS = 320
const STEP = 360 / COUNT
const TILT = 60

const currentAngle = ref(0)
let targetAngle = 0
let rafId = 0
const hoveredIdx = ref<number | null>(null)

const cardTransforms = computed(() =>
  ALBUMS.map((_, i) => {
    const ry = i * STEP
    return {
      '--ry': `${ry}deg`,
      '--tz': `${RADIUS}px`,
      transform: `rotateY(${ry}deg) translateZ(${RADIUS}px)`,
    }
  })
)

const ringStyle = computed(() => ({
  transform: `rotateX(${TILT}deg) rotateY(${currentAngle.value}deg)`,
}))

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
  targetAngle += e.deltaY * 0.12
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
    <div class="scene">
      <div class="ring" :style="ringStyle">
        <div
          v-for="(album, i) in ALBUMS"
          :key="i"
          class="card"
          :class="{ hovered: hoveredIdx === i }"
          :style="cardTransforms[i]"
          @mouseenter="hoveredIdx = i"
          @mouseleave="hoveredIdx = null"
        >
          <img :src="album.cover" :alt="album.title" loading="lazy" />
          <div class="overlay">
            <span class="title">{{ album.title }}</span>
          </div>
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
  background: #0a0a0f;
  position: relative;
}

.scene {
  width: 100%;
  height: 100%;
  position: relative;
  perspective: 900px;
  perspective-origin: 50% 45%;
  overflow: hidden;
}

.ring {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.card {
  position: absolute;
  width: 130px;
  height: 173px;
  left: 50%;
  top: 50%;
  margin-left: -65px;
  margin-top: -86px;
  border-radius: 12px;
  overflow: hidden;
  backface-visibility: hidden;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition:
    transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    box-shadow 0.4s ease,
    border-color 0.4s ease;
}

.card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease, filter 0.4s ease;
  filter: brightness(0.8);
}

.overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  transform: translateY(100%);
  transition: transform 0.35s ease;
}

.title {
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.card.hovered {
  transform: rotateY(var(--ry)) translateZ(calc(var(--tz) + 60px)) scale(1.12) !important;
  box-shadow:
    0 0 40px rgba(139, 92, 246, 0.5),
    0 0 80px rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.6);
  z-index: 10;
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
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: #666;
  font-size: 13px;
  font-family: system-ui, sans-serif;
}
</style>
