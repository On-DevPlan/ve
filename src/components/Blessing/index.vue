<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const hearts = ref([])
const particles = ref([])
let animationId = null

const heartCount = 8
const particleCount = 40

function createHeart() {
  const size = 20 + Math.random() * 30
  return {
    id: Math.random(),
    x: Math.random() * 100,
    size,
    speed: 1 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.4,
    hue: Math.random() < 0.5 ? 340 : 30
  }
}

function createParticle() {
  return {
    id: Math.random(),
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    speedX: (Math.random() - 0.5) * 0.2,
    speedY: (Math.random() - 0.5) * 0.2,
    opacity: 0.15 + Math.random() * 0.25,
    hue: 30 + Math.random() * 30
  }
}

function initHearts() {
  hearts.value = Array.from({ length: heartCount }, () => ({
    ...createHeart(),
    y: 80 + Math.random() * 20
  }))
}

function initParticles() {
  particles.value = Array.from({ length: particleCount }, createParticle)
}

function animate() {
  hearts.value = hearts.value.map(heart => {
    let y = heart.y - heart.speed * 0.05
    if (y < -15) {
      y = 100 + Math.random() * 10
      heart.x = Math.random() * 100
      heart.speed = 1 + Math.random() * 2
    }
    return { ...heart, y }
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
  initHearts()
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
  <div class="blessing">
    <div class="background"></div>

    <div
      v-for="particle in particles"
      :key="particle.id"
      class="particle"
      :style="{
        left: particle.x + '%',
        top: particle.y + '%',
        width: particle.size + 'px',
        height: particle.size + 'px',
        opacity: particle.opacity,
        '--hue': particle.hue
      }"
    ></div>

    <div
      v-for="heart in hearts"
      :key="heart.id"
      class="heart"
      :style="{
        left: heart.x + '%',
        bottom: -heart.size + 'px',
        width: heart.size + 'px',
        height: heart.size + 'px',
        opacity: heart.opacity,
        '--hue': heart.hue
      }"
    ></div>

    <div class="content">
      <h1 class="text">浪漫安宁</h1>
      <p class="subtext">温暖永在</p>
    </div>
  </div>
</template>

<style scoped>
.blessing {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.background {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    #1a0a15 0%,
    #2d1f3d 30%,
    #3d2a4a 60%,
    #1a1520 100%
  );
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: hsla(var(--hue), 80%, 70%, 0.8);
  pointer-events: none;
}

.heart {
  position: absolute;
  pointer-events: none;
  background: hsla(var(--hue), 70%, 60%, 0.6);
  transform: rotate(-45deg);
  animation: pulse 3s ease-in-out infinite;
}

.heart::before,
.heart::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: inherit;
}

.heart::before {
  top: -50%;
  left: 0;
}

.heart::after {
  top: 0;
  left: 50%;
}

@keyframes pulse {
  0%, 100% {
    transform: rotate(-45deg) scale(1);
    opacity: 0.3;
  }
  50% {
    transform: rotate(-45deg) scale(1.1);
    opacity: 0.5;
  }
}

.content {
  text-align: center;
  z-index: 10;
}

.text {
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 300;
  color: #fff;
  margin: 0;
  letter-spacing: 0.3em;
  text-shadow: 0 0 40px hsla(340, 70%, 60%, 0.5);
  animation: glow 4s ease-in-out infinite;
}

.subtext {
  font-size: clamp(1rem, 3vw, 1.8rem);
  font-weight: 300;
  color: hsla(30, 80%, 70%, 0.9);
  margin: 20px 0 0 0;
  letter-spacing: 0.5em;
  text-shadow: 0 0 30px hsla(30, 70%, 60%, 0.4);
}

@keyframes glow {
  0%, 100% {
    text-shadow: 0 0 40px hsla(340, 70%, 60%, 0.5);
  }
  50% {
    text-shadow: 0 0 60px hsla(340, 80%, 70%, 0.7);
  }
}
</style>
