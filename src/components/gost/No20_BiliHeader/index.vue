<script setup>
import { ref } from 'vue'

const shellRef = ref(null)
const videoRef = ref(null)
let lastX = 36

const handleMouseEnter = (e) => {
  lastX = e.clientX
  if (videoRef.value) {
    videoRef.value.style.transition = 'none'
  }
}

const handleMouseMove = (e) => {
  const disx = e.clientX - lastX
  const move = 36 - disx / -20
  if (videoRef.value) {
    videoRef.value.style.transform = `translate(${move}px,-8px)`
  }
}

const handleMouseLeave = () => {
  if (videoRef.value) {
    videoRef.value.style.transition = '.3s'
    videoRef.value.style.transform = 'translate(36px,-8px)'
  }
}
</script>

<template>
  <div class="demo-wrapper" ref="shellRef"
    @mouseenter="handleMouseEnter"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave">
    <div class="shell">
      <video ref="videoRef" autoplay="autoplay" src="/gost/No20_BiliHeader/81909048-c89a-4106-880c-175d52c70140.mp4"
        class="video" style="height: 100%; transform: translate(36px,-8px);"></video>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  justify-content: center;
}
.shell {
  width: 100%;
  height: 162px;
  display: flex;
  justify-content: center;
}
.video {
  transition: .3s;
}
</style>
