<template>
  <div class="demo-wrapper">
    <img id="spidereye" :src="currentSrc" :style="{ transform: 'rotate(' + (-angle + 20) + 'deg)' }" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const MAX_FRAMES = 73
const currentSrc = ref('')
const angle = ref(0)

const frames = []

const init = () => {
  for (let i = 0; i <= MAX_FRAMES; i++) {
    const img = new Image()
    img.src = `/gie/No05_SpiderEye/spider eye_${i}.webp`
    frames.push(img)
  }
  currentSrc.value = frames[0].src
}

const rotateEye = (x, y) => {
  const nums = (x - window.innerWidth / 2) / (y - window.innerHeight / 2)
  let rotateAngle
  if (y >= window.innerHeight / 2) {
    rotateAngle = (Math.atan(nums) * 180) / Math.PI + 90
  } else {
    rotateAngle = 360 - 90 + (Math.atan(nums) * 180) / Math.PI
  }
  angle.value = rotateAngle
  const targetFrame = parseInt((360 - rotateAngle) / 4.86) % (MAX_FRAMES + 1)
  currentSrc.value = frames[targetFrame]?.src || frames[0].src
}

const handleMouseMove = (e) => {
  rotateEye(e.clientX, e.clientY)
}

onMounted(() => {
  init()
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #171717;
  display: flex;
  justify-content: center;
  align-items: center;
}

#spidereye {
  position: absolute;
  width: 35rem;
  transition: transform 0.1s;
}
</style>
