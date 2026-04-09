<template>
  <div class="demo-wrapper">
    <div class="empty"> keep scroll</div>
    <div class="empty"> keep scroll</div>
    <div class="empty"> keep scroll</div>
    <div class="container" ref="containerRef">
      <div class="container_box" ref="boxRef">
        <svg viewBox="0 0 170 50">
          <text ref="textRef" x="10" y="40"> SCROLL </text>
        </svg>
      </div>
      <div class="container_contents">
        <p v-for="i in 16" :key="i">This is the normal scrolling section</p>
        <br v-for="i in 7" :key="'br'+i" />
      </div>
    </div>
    <div class="empty"> keep scroll</div>
    <div class="empty"> keep scroll</div>
    <div class="empty"> keep scroll</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Lenis from 'lenis'

const containerRef = ref(null)
const boxRef = ref(null)
const textRef = ref(null)

let lenis = null
let distanceScroll = 0
let distanceTrigger = 0
let distanceEdge = 0

const scrollHandler = () => {
  if (!containerRef.value || !boxRef.value || !textRef.value) return

  if (window.scrollY < distanceTrigger) {
    boxRef.value.style = null
    distanceScroll = 0
  } else {
    distanceScroll = window.scrollY - distanceTrigger
    distanceScroll = Math.max(0, distanceScroll)
    distanceScroll = Math.min(distanceEdge, distanceScroll)

    if (distanceScroll === distanceEdge) {
      boxRef.value.style.position = 'absolute'
      boxRef.value.style.transform = `translateY(${distanceScroll}px)`
    } else {
      boxRef.value.style.position = 'fixed'
      boxRef.value.style.transform = 'translateY(0px)'
    }
    textRef.value.style.strokeDashoffset = `${150 - (distanceScroll / distanceEdge) * 150}px`
  }
}

const resize = () => {
  if (!containerRef.value) return
  distanceTrigger = containerRef.value.offsetTop
  distanceEdge = containerRef.value.offsetHeight - window.innerHeight
}

onMounted(() => {
  lenis = new Lenis({ autoRaf: true })

  resize()
  scrollHandler()

  lenis.on('scroll', scrollHandler)
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  if (lenis) {
    lenis.destroy()
  }
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.demo-wrapper {
  width: 100vw;
  background-color: #171717;
}

.empty {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 30rem;
  font-family: sans-serif;
  font-size: 2rem;
  color: #171717;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 5rem;
  background-color: #17f700;
}

.container {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 5rem;
}

.container_box {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  left: 0;
  top: 0;
  width: 100%;
  height: 100vh;
  background-color: #171717;
  z-index: 1;
}

.container_box svg {
  position: absolute;
  width: 40rem;
}

.container_box svg text {
  font-family: sans-serif;
  font-size: 40px;
  font-weight: bold;
  fill: none;
  stroke: #17f700;
  stroke-width: 1;
  stroke-dasharray: 150;
  stroke-dashoffset: 150;
}

.container_contents {
  z-index: 2;
}

.container_contents p {
  font-family: sans-serif;
  font-size: 2rem;
  color: #17f700;
  margin-bottom: 2rem;
  opacity: 0.2;
}
</style>
