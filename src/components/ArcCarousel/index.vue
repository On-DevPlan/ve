<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Album {
  title: string
  cover: string
  tags: string[]
}

const albums: Album[] = [
  { title: 'Jazz', cover: 'https://picsum.photos/seed/c1/280/200', tags: ['Smooth', 'Classic'] },
  { title: 'Blues', cover: 'https://picsum.photos/seed/c2/280/200', tags: ['Blues', 'Classic'] },
  { title: 'Metal', cover: 'https://picsum.photos/seed/c3/280/200', tags: ['New', 'Instrumental'] },
  { title: 'R&B', cover: 'https://picsum.photos/seed/c4/280/200', tags: ['Soul', 'Vocal'] },
  { title: 'Pop', cover: 'https://picsum.photos/seed/c5/280/200', tags: ['Dance', 'Hits'] },
  { title: 'Rock', cover: 'https://picsum.photos/seed/c6/280/200', tags: ['Guitar', 'Live'] },
  { title: 'Hip Hop', cover: 'https://picsum.photos/seed/c7/280/200', tags: ['Beats', 'Flow'] },
  { title: 'Classical', cover: 'https://picsum.photos/seed/c8/280/200', tags: ['Orchestra'] },
  { title: 'Electronic', cover: 'https://picsum.photos/seed/c9/280/200', tags: ['EDM', 'Synth'] },
]

const ARC_RADIUS = 1200
const ANGLE_STEP = 8
const MAX_VISIBLE_ANGLE = 35

const offset = ref(0)
let targetOffset = 0
let rafId = 0
const hoveredIdx = ref<number | null>(null)

const deg2rad = (d: number) => (d * Math.PI) / 180

const cardStyles = computed(() =>
  albums.map((_, i) => {
    const angleDeg = (i - offset.value) * ANGLE_STEP
    const angleRad = deg2rad(angleDeg)
    const absAngle = Math.abs(angleDeg)

    const x = ARC_RADIUS * Math.sin(angleRad)
    const y = ARC_RADIUS * (1 - Math.cos(angleRad))

    const scale = Math.max(0.55, 1 - absAngle / 60)
    const opacity = absAngle > MAX_VISIBLE_ANGLE ? 0 : Math.max(0.3, 1 - absAngle / 45)
    const zIndex = 100 - Math.round(absAngle)

    return {
      transform: `translate(${x}px, ${y}px) rotate(${angleDeg}deg) scale(${scale})`,
      opacity,
      zIndex,
      pointerEvents: absAngle > MAX_VISIBLE_ANGLE ? 'none' : 'auto',
    }
  })
)

function animate() {
  const diff = targetOffset - offset.value
  if (Math.abs(diff) > 0.001) {
    offset.value += diff * 0.1
  } else {
    offset.value = targetOffset
  }
  rafId = requestAnimationFrame(animate)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  targetOffset += e.deltaY * 0.005
  targetOffset = Math.max(-1, Math.min(albums.length - 1 + 1, targetOffset))
}

function go(dir: number) {
  targetOffset = Math.max(-1, Math.min(albums.length, targetOffset + dir))
}

onMounted(() => {
  targetOffset = Math.floor(albums.length / 2)
  offset.value = targetOffset
  rafId = requestAnimationFrame(animate)
  window.addEventListener('wheel', onWheel, { passive: false })
})
onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('wheel', onWheel)
})
</script>

<template>
  <div class="arc-carousel-app">
    <div class="carousel-wrapper">
      <button class="arrow left" @click="go(-1)">‹</button>

      <div class="arc-stage">
        <div
          v-for="(album, i) in albums"
          :key="i"
          class="card"
          :class="{ hovered: hoveredIdx === i }"
          :style="cardStyles[i]"
          @mouseenter="hoveredIdx = i"
          @mouseleave="hoveredIdx = null"
        >
          <div class="cover">
            <img :src="album.cover" :alt="album.title" />
            <div class="play-btn">▶</div>
          </div>
          <div class="info">
            <h3>{{ album.title }}</h3>
            <div class="tags">
              <span v-for="tag in album.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <button class="arrow right" @click="go(1)">›</button>
    </div>
  </div>
</template>

<style scoped>
.arc-carousel-app {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  font-family: system-ui, -apple-system, sans-serif;
}

.carousel-wrapper {
  position: relative;
  width: 100%;
  max-width: 1100px;
  height: 420px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
}

.arc-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.card {
  position: absolute;
  left: 50%;
  top: 40px;
  margin-left: -110px;
  width: 220px;
  background: #c4b5fd;
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transform-origin: center bottom;
  transition: box-shadow 0.3s ease;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
}

.card.hovered {
  box-shadow:
    0 12px 40px rgba(139, 92, 246, 0.35),
    0 0 0 3px rgba(139, 92, 246, 0.25);
}
.card.hovered .cover img {
  transform: scale(1.06);
}
.card.hovered .play-btn {
  opacity: 1;
  transform: scale(1);
}

.cover {
  position: relative;
  width: calc(100% - 20px);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 12px;
  margin: 10px auto 0;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
  border-radius: 12px;
}

.play-btn {
  position: absolute;
  bottom: 10px;
  left: 10px;
  width: 36px;
  height: 36px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0.85;
  transform: scale(0.9);
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.info {
  padding: 12px 14px 14px;
}
.info h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1e1b4b;
}
.tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.tag {
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  color: #4c1d95;
  font-weight: 500;
}

.arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 200;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #d4d4d8;
  background: #fff;
  font-size: 22px;
  color: #555;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background 0.2s;
}
.arrow:hover { background: #f3f4f6; }
.arrow.left { left: 12px; }
.arrow.right { right: 12px; }
</style>
