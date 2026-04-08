<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const imgRef = ref(null)
let deg = 0
let imgx = 0
let imgy = 0
let imgl = 0
let imgt = 0
let y = 0
let index = 0
let intervalId = null

function handleMouseMove(xyz) {
  imgx = xyz.x - imgRef.value.offsetLeft - imgRef.value.clientWidth / 2
  imgy = xyz.y - imgRef.value.offsetTop - imgRef.value.clientHeight / 2
  deg = 360 * Math.atan(imgy / imgx) / (2 * Math.PI)
  index = 0
  const x = xyz.clientX
  if (imgRef.value.offsetLeft < x) {
    y = -180
  } else {
    y = 0
  }
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  intervalId = setInterval(() => {
    imgRef.value.style.transform = 'rotateZ(' + deg + 'deg) rotateY(' + y + 'deg)'
    index++
    if (index < 50) {
      imgl += imgx / 50
      imgt += imgy / 50
    }
    imgRef.value.style.left = imgl + 'px'
    imgRef.value.style.top = imgt + 'px'
  }, 10)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <div class="demo-wrapper">
    <div ref="imgRef" class="img"></div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: rgb(240, 230, 240);
}
.img {
  width: 50px;
  height: 50px;
  position: absolute;
  background-image: url('/gost/No35_MousePet/goat.gif');
  background-size: cover;
}
</style>
