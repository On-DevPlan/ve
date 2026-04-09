<template>
  <div class="demo-wrapper">
    <div class="container" ref="containerRef"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const containerRef = ref(null)

const LENGTH = 50
const DISTANCE = 1

const init = () => {
  if (!containerRef.value) return

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${LENGTH * 3} ${LENGTH * 2}`)

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  let points = ''
  let y = 0

  for (let i = 0; i < LENGTH; i++) {
    y += DISTANCE
    if (i % 2 === 1) points += ` 0,${y} ${LENGTH},${y}`
    else points += ` ${LENGTH},${y} 0,${y}`
  }

  points += ` ${LENGTH},${y} ${LENGTH * 2},${y}`

  for (let i = 0; i < LENGTH; i++) {
    if (i % 2 === 0) points += `  ${LENGTH * 2},${y}  ${LENGTH * 3},${y}`
    else points += `  ${LENGTH * 3},${y}  ${LENGTH * 2},${y}`
    y += DISTANCE
  }

  polygon.setAttribute('points', points)
  svg.appendChild(polygon)
  containerRef.value.appendChild(svg)

  // Static display - set full dashoffset to show left pattern
  polygon.style.strokeDasharray = `${LENGTH * LENGTH + DISTANCE * LENGTH * 2 + LENGTH} 0`
  polygon.style.strokeDashoffset = '0'
}

onMounted(() => {
  init()
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
}

svg {
  height: 35rem;
  overflow: visible;
}

svg polygon {
  fill: none;
  stroke-width: 0.5;
  stroke: #17f700;
}
</style>
