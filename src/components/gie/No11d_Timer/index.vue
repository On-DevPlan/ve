<template>
  <div class="demo-wrapper">
    <div class="container">
      <svg viewbox="0 0 70 140" v-for="i in 6" :key="i">
        <polygon ref="polygons" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const polygons = ref([])

const DASHARRAY_DATA = [
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 70 0 5 60 5 0 70 0 5 60 5 0 70 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
]

const DASHARRAY_MAP = [
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 70 0 5 60 5 0 70 0 5 60 5 0 70 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
  '0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 5 60 5 0 70 0',
]

let timer = null

const updateTime = () => {
  const times = [
    new Date().getHours(),
    new Date().getMinutes(),
    new Date().getSeconds()
  ].flatMap(time => [Math.floor(time / 10), time % 10])

  polygons.value.forEach((polygon, index) => {
    if (polygon) {
      polygon.style.strokeDasharray = DASHARRAY_MAP[times[index]]
    }
  })
}

onMounted(() => {
  polygons.value = Array.from(document.querySelectorAll('.demo-wrapper polygon'))
  polygons.value.forEach((p) => {
    if (p) p.style.strokeDasharray = DASHARRAY_MAP[0]
  })
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
* {
  font-size: 2vmin;
  padding: 0;
  margin: 0;
}

.demo-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: #171717;
}

.container {
  position: absolute;
  display: flex;
}

.container svg {
  width: 5rem;
  overflow: visible;
  margin-right: 1.5rem;
}

.container svg:nth-child(even) {
  margin-right: 4rem;
}

.container svg:nth-child(5) {
  margin-right: 1.5rem;
}

polygon {
  fill: none;
  stroke-width: 8;
  stroke: #17f700;
  transition: stroke-dasharray 0.5s ease;
}
</style>
