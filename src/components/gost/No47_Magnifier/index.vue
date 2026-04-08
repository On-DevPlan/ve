<script setup>
import { ref, onMounted } from 'vue'

const containerRef = ref(null)
const mirrorRef = ref(null)
const bigImgRef = ref(null)

onMounted(() => {
  const container = containerRef.value
  const mirror = mirrorRef.value
  const bigImg = bigImgRef.value
  if (!container || !mirror || !bigImg) return

  const handleMouseMove = (e) => {
    let x = e.clientX
    let y = e.clientY
    let left = container.offsetLeft
    let top = container.offsetTop
    let mirrorLeft = x - left - mirror.offsetWidth / 2
    let mirrorTop = y - top - mirror.offsetHeight / 2

    mirror.style.left = mirrorLeft + 'px'
    mirror.style.top = mirrorTop + 'px'

    let bigImgLeft = (mirrorLeft + mirror.offsetWidth / 2) / container.offsetWidth * bigImg.offsetWidth - mirror.offsetWidth / 2
    let bigImgTop = (mirrorTop + mirror.offsetHeight / 2) / container.offsetHeight * bigImg.offsetHeight - mirror.offsetHeight / 2

    bigImg.style.left = -bigImgLeft + 'px'
    bigImg.style.top = -bigImgTop + 'px'
  }

  container.addEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="container" ref="containerRef">
      <img src="/gost/No47_Magnifier/5.jpg" alt="" width="100%">
      <div class="mirror" ref="mirrorRef">
        <img src="/gost/No47_Magnifier/5.jpg" alt="" ref="bigImgRef">
      </div>
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
  align-items: center;
  background-color: rgba(255, 190, 221, 0.5);
}

.container {
  width: 900px;
  box-shadow: 0 0 20px rgba(0, 0, 0, .4);
  position: relative;
  overflow: hidden;
}

.mirror {
  width: 240px;
  height: 240px;
  border-radius: 50%;
  border: solid 10px #fff;
  overflow: hidden;
  transform: translate(-10px, -10px);
  box-shadow: 0 0 40px rgba(0, 0, 0, .4);
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.mirror img {
  position: absolute;
}
</style>
