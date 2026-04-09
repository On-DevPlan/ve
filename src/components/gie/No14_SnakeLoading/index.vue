<template>
  <div class="demo-wrapper">
    <div class="loading">
      <svg viewBox="0 0 100 50" class="loading_icon">
        <path d="M50,25c0-12.14,9.84-21.99,21.99-21.99S93.98,12.86,93.98,25s-9.84,21.99-21.99,21.99S50,37.21,50,25.06
        S40.16,3.01,28.01,3.01S6.02,12.86,6.02,25s9.84,21.99,21.99,21.99S50,37.14,50,25c0-8.14,4.42-15.24,10.99-19.05
        C67.57,9.76,71.99,16.86,71.99,25c0,8.14-4.42,15.24-10.99,19.04c0,0,0,0,0,0c-3.23,1.87-6.99,2.94-10.99,2.94
        c-4.01,0-7.76-1.07-10.99-2.94h0C32.43,40.24,28.01,33.14,28.01,25c0-8.14,4.42-15.24,10.99-19.05l0,0
        C42.24,4.08,45.99,3.01,50,3.01s7.76,1.07,10.99,2.94l0,0" />
        <path d="M50,25c0-12.14,9.84-21.99,21.99-21.99S93.98,12.86,93.98,25s-9.84,21.99-21.99,21.99S50,37.21,50,25.06
        S40.16,3.01,28.01,3.01S6.02,12.86,6.02,25s9.84,21.99,21.99,21.99S50,37.14,50,25c0-8.14,4.42-15.24,10.99-19.05
        C67.57,9.76,71.99,16.86,71.99,25c0,8.14-4.42,15.24-10.99,19.04c0,0,0,0,0,0c-3.23,1.87-6.99,2.94-10.99,2.94
        c-4.01,0-7.76-1.07-10.99-2.94h0C32.43,40.24,28.01,33.14,28.01,25c0-8.14,4.42-15.24,10.99-19.05l0,0
        C42.24,4.08,45.99,3.01,50,3.01s7.76,1.07,10.99,2.94l0,0" />
      </svg>
      <div class="loading_circle"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const paths = ref([])
const circle = ref(null)
let animater = null

const init = () => {
  const pathEls = document.querySelectorAll('.demo-wrapper .loading_icon path')
  const circleEl = document.querySelector('.demo-wrapper .loading_circle')
  paths.value = Array.from(pathEls)
  circle.value = circleEl

  let index = 0
  animater = gsap.timeline()
    .fromTo(
      paths.value,
      {
        strokeDashoffset: (i) => i === 0 ? 0 : 480
      },
      {
        strokeDashoffset: (i) => i === 0 ? -275 : 205,
        duration: 2,
        ease: 'linear',
        onComplete: () => {
          index++
          if (index >= 2) finish()
          else animater.restart()
        }
      }
    )
}

const finish = () => {
  animater = gsap.timeline()
    .to(paths.value[1], {
      strokeWidth: 0,
      duration: 0.4,
      ease: 'power3.out'
    })
    .to(paths.value[0], {
      strokeDasharray: '150 0 0 0 0 0 0 0 0 500',
      strokeDashoffset: -300,
      duration: 0.7,
      ease: 'power3.out'
    }, '<')
    .to(circle.value, {
      opacity: 1,
      duration: 0.7,
      ease: 'power3.out'
    }, '<0.3')
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  if (animater) animater.kill()
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
  height: 100dvh;
  background-color: #171717;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading_icon {
  position: absolute;
  width: 35rem;
}

.loading_icon path {
  fill: none;
  stroke: #17f700;
  stroke-linecap: round;
}

.loading_icon path:nth-child(1) {
  stroke-width: 2;
  stroke-dasharray: 0 5 0 5 0 5 0 5 0 500;
}

.loading_icon path:nth-child(2) {
  stroke-width: 4;
  stroke-dasharray: 0 500 0 500;
  stroke-dashoffset: 480;
}

.loading_circle {
  position: absolute;
  width: 15rem;
  height: 15rem;
  border-radius: 100%;
  background-color: #17f700;
  opacity: 0;
}
</style>
