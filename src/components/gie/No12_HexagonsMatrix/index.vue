<template>
  <div class="demo-wrapper">
    <svg class="loading" viewBox="0 0 1000 1000" ref="svgRef">
      <defs>
        <polygon id="loading_hexagon" points="0,-50 43.3,-25 43.3,25 0,50 -43.3,25 -43.3,-25" fill="#171717" />
      </defs>
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const svgRef = ref(null)
const blocks = []
let timeline = null

const init = () => {
  if (!svgRef.value) return
  const container = svgRef.value
  const ROW = 15
  const LINE = 15

  for (let l = 0; l < LINE; l++) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    for (let r = 0; r < ROW; r++) {
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
      use.setAttribute('class', 'loading_block')
      use.setAttribute('href', '#loading_hexagon')
      use.setAttribute('x', `${l % 2 ? 86.5 * r : 86.5 * r + 43.3}`)
      use.setAttribute('y', `${74.5 * l}`)
      use.setAttribute('transform-origin', '50 50')
      g.appendChild(use)
      blocks.push(use)
    }
    container.appendChild(g)
  }

  setTimeout(() => {
    hidden()
  }, 1000)
}

const hidden = () => {
  if (!blocks.length) return
  timeline = gsap.timeline()
    .set(blocks, {
      'stroke-dashoffset': () => Math.random() > 0.5 ? -100 : 100
    })
    .to(blocks, {
      'stroke-dashoffset': 0,
      'stroke-opacity': 1,
      duration: 0.5,
      ease: 'power4.out',
      stagger: {
        from: 'random',
        each: 0.002
      }
    })
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  if (timeline) timeline.kill()
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.demo-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
}

.loading {
  position: absolute;
  width: 100%;
  height: auto;
}

.loading_block {
  stroke: #17f700;
  stroke-width: 0.8;
  stroke-dasharray: 100;
  stroke-opacity: 0;
}
</style>
