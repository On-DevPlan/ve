<template>
  <div class="demo-wrapper">
    <svg class="container" ref="containerRef"></svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const containerRef = ref(null)
const ROWS = 10
const LINES = 10
const BALL_RADIUS = 30
const MOUSE_RADIUS = 180

let balls = []
let containerLeft = 0
let containerTop = 0
let containerWidth = 0
let containerHeight = 0
let gsapTimelines = []

const resize = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  containerLeft = rect.left
  containerTop = rect.top
  containerWidth = rect.width
  containerHeight = rect.height
}

const init = () => {
  if (!containerRef.value) return
  resize()

  for (let r = 0; r <= ROWS; r++) {
    for (let l = 0; l <= LINES; l++) {
      const x = containerWidth / LINES * l
      const y = containerHeight / ROWS * r

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', '#f7f7f7')
      line.setAttribute('stroke-width', '2')
      line.setAttribute('cx', x)
      line.setAttribute('cy', y)
      line.setAttribute('r', '0')
      containerRef.value.appendChild(line)

      const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      point.setAttribute('fill', '#f7f7f7')
      point.setAttribute('cx', x)
      point.setAttribute('cy', y)
      point.setAttribute('r', BALL_RADIUS / 5)
      containerRef.value.appendChild(point)

      const ball = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      ball.setAttribute('fill', '#17f700')
      ball.setAttribute('cx', x)
      ball.setAttribute('cy', y)
      ball.setAttribute('r', BALL_RADIUS)
      ball.line = line
      ball.ori_x = x
      ball.ori_y = y
      ball.move_x = x
      ball.move_y = y
      ball.animater = null
      containerRef.value.appendChild(ball)
      balls.push(ball)
    }
  }
}

const moveBalls = (mouseX, mouseY) => {
  const mx = mouseX - containerLeft
  const my = mouseY - containerTop

  balls.forEach((ball) => {
    const dx = ball.ori_x - mx
    const dy = ball.ori_y - my
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance <= MOUSE_RADIUS) {
      ball.move_x = mx + dx / distance * MOUSE_RADIUS
      ball.move_y = my + dy / distance * MOUSE_RADIUS

      if (ball.animater) ball.animater.kill()
      ball.animater = gsap.timeline()
        .to(ball, {
          attr: { cx: ball.move_x, cy: ball.move_y },
          duration: 0.5,
          ease: 'power3.out'
        })
        .to(ball.line, {
          attr: { x2: ball.move_x, y2: ball.move_y },
          duration: 0.5,
          ease: 'power3.out'
        }, '<')
        .to(ball, {
          attr: { cx: ball.ori_x, cy: ball.ori_y },
          duration: 1,
          ease: 'power3.out'
        }, '<0.1')
        .to(ball.line, {
          attr: { x2: ball.ori_x, y2: ball.ori_y },
          duration: 1,
          ease: 'power3.out'
        }, '<')
    }
  })
}

let throttled = false
const handleMouseMove = (e) => {
  if (throttled) return
  throttled = true
  moveBalls(e.clientX, e.clientY)
  setTimeout(() => { throttled = false }, 16)
}

onMounted(() => {
  init()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', handleMouseMove)
  gsapTimelines.forEach(t => t?.kill())
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

.container {
  position: absolute;
  width: 50rem;
  height: 50rem;
  overflow: visible;
}
</style>
