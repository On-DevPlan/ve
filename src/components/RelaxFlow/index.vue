<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const bubbles = ref([])
const particles = ref([])
let animationId = null

const bubbleCount = 12
const particleCount = 30

function createBubble() {
  const size = 40 + Math.random() * 80
  return {
    id: Math.random(),
    x: Math.random() * 100,
    size,
    speed: 3 + Math.random() * 5,
    opacity: 0.3 + Math.random() * 0.4,
    hue: 200 + Math.random() * 20
  }
}

function createParticle() {
  return {
    id: Math.random(),
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 3,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3,
    opacity: 0.2 + Math.random() * 0.3
  }
}

function initBubbles() {
  bubbles.value = Array.from({ length: bubbleCount }, () => ({
    ...createBubble(),
    y: Math.random() * 120
  }))
}

function initParticles() {
  particles.value = Array.from({ length: particleCount }, createParticle)
}

function animate() {
  bubbles.value = bubbles.value.map(bubble => {
    let y = bubble.y - bubble.speed * 0.1
    if (y < -15) {
      y = 110 + Math.random() * 10
      bubble.x = Math.random() * 100
      bubble.speed = 3 + Math.random() * 5
    }
    return { ...bubble, y }
  })

  particles.value = particles.value.map(p => {
    let x = p.x + p.speedX
    let y = p.y + p.speedY
    if (x < 0) x = 100
    if (x > 100) x = 0
    if (y < 0) y = 100
    if (y > 100) y = 0
    return { ...p, x, y }
  })

  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  initBubbles()
  initParticles()
  animate()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<template>
  <div class="relax-flow">
    <!-- 背景渐变 -->
    <div class="background"></div>

    <!-- 背景粒子 -->
    <div
      v-for="particle in particles"
      :key="particle.id"
      class="particle"
      :style="{
        left: particle.x + '%',
        top: particle.y + '%',
        width: particle.size + 'px',
        height: particle.size + 'px',
        opacity: particle.opacity
      }"
    ></div>

    <!-- 气泡 -->
    <div
      v-for="bubble in bubbles"
      :key="bubble.id"
      class="bubble"
      :style="{
        left: bubble.x + '%',
        bottom: -bubble.size + 'px',
        width: bubble.size + 'px',
        height: bubble.size + 'px',
        opacity: bubble.opacity,
        '--hue': bubble.hue
      }"
    ></div>
  </div>
</template>

<style scoped>
.relax-flow {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.background {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    #0a1628 0%,
    #1a3a5c 50%,
    #2d5a87 100%
  );
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}

.bubble {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    hsla(var(--hue), 70%, 80%, 0.8),
    hsla(var(--hue), 70%, 50%, 0.4) 50%,
    hsla(var(--hue), 70%, 40%, 0.2)
  );
  box-shadow:
    0 0 20px hsla(var(--hue), 80%, 60%, 0.3),
    inset 0 0 20px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(2px);
  pointer-events: none;
  animation: float linear infinite;
}
</style>
