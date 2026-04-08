<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
let animationId = null

const STAR_COLOR = '#fff'
const STAR_SIZE = 3
const STAR_MIN_SCALE = 0.2
const OVERFLOW_THRESHOLD = 50

let scale = 1
let width = 0
let height = 0
let stars = []
let pointerX
let pointerY
let velocity = { x: 0, y: 0, tx: 0, ty: 0, z: 0.0009 }
let touchInput = false

function generate() {
  const STAR_COUNT = (window.innerWidth + window.innerHeight) / 8
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: 0,
      y: 0,
      z: STAR_MIN_SCALE + Math.random() * (1 - STAR_MIN_SCALE),
    })
  }
}

function placeStar(star) {
  star.x = Math.random() * width
  star.y = Math.random() * height
}

function recycleStar(star) {
  let direction = 'z'
  let vx = Math.abs(velocity.x)
  let vy = Math.abs(velocity.y)
  if (vx > 1 || vy > 1) {
    let axis
    if (vx > vy) {
      axis = Math.random() < vx / (vx + vy) ? 'h' : 'v'
    } else {
      axis = Math.random() < vy / (vx + vy) ? 'v' : 'h'
    }
    if (axis === 'h') {
      direction = velocity.x > 0 ? 'l' : 'r'
    } else {
      direction = velocity.y > 0 ? 't' : 'b'
    }
  }
  star.z = STAR_MIN_SCALE + Math.random() * (1 - STAR_MIN_SCALE)
  if (direction === 'z') {
    star.z = 0.1
    star.x = Math.random() * width
    star.y = Math.random() * height
  } else if (direction === 'l') {
    star.x = -OVERFLOW_THRESHOLD
    star.y = height * Math.random()
  } else if (direction === 'r') {
    star.x = width + OVERFLOW_THRESHOLD
    star.y = height * Math.random()
  } else if (direction === 't') {
    star.x = width * Math.random()
    star.y = -OVERFLOW_THRESHOLD
  } else if (direction === 'b') {
    star.x = width * Math.random()
    star.y = height + OVERFLOW_THRESHOLD
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  scale = window.devicePixelRatio || 1
  width = window.innerWidth * scale
  height = window.innerHeight * scale
  canvas.width = width
  canvas.height = height
  stars.forEach(placeStar)
}

function step() {
  const canvas = canvasRef.value
  if (!canvas) return
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, width, height)
  update(context)
  render(context)
  animationId = requestAnimationFrame(step)
}

function update() {
  velocity.tx *= 0.96
  velocity.ty *= 0.96
  velocity.x += (velocity.tx - velocity.x) * 0.8
  velocity.y += (velocity.ty - velocity.y) * 0.8

  stars.forEach((star) => {
    star.x += velocity.x * star.z
    star.y += velocity.y * star.z
    star.x += (star.x - width / 2) * velocity.z * star.z
    star.y += (star.y - height / 2) * velocity.z * star.z
    star.z += velocity.z
    if (
      star.x < -OVERFLOW_THRESHOLD ||
      star.x > width + OVERFLOW_THRESHOLD ||
      star.y < -OVERFLOW_THRESHOLD ||
      star.y > height + OVERFLOW_THRESHOLD
    ) {
      recycleStar(star)
    }
  })
}

function render(context) {
  stars.forEach((star) => {
    context.beginPath()
    context.lineCap = 'round'
    context.lineWidth = STAR_SIZE * star.z * scale
    context.globalAlpha = 0.5 + 0.5 * Math.random()
    context.strokeStyle = STAR_COLOR
    context.beginPath()
    context.moveTo(star.x, star.y)
    let tailX = velocity.x * 2
    let tailY = velocity.y * 2
    if (Math.abs(tailX) < 0.1) tailX = 0.5
    if (Math.abs(tailY) < 0.1) tailY = 0.5
    context.lineTo(star.x + tailX, star.y + tailY)
    context.stroke()
  })
}

function movePointer(x, y) {
  if (typeof pointerX === 'number' && typeof pointerY === 'number') {
    let ox = x - pointerX
    let oy = y - pointerY
    velocity.tx = velocity.tx + (ox / 8) * scale * (touchInput ? 1 : -1)
    velocity.ty = velocity.ty + (oy / 8) * scale * (touchInput ? 1 : -1)
  }
  pointerX = x
  pointerY = y
}

function onMouseMove(event) {
  touchInput = false
  movePointer(event.clientX, event.clientY)
}

function onTouchMove(event) {
  touchInput = true
  movePointer(event.touches[0].clientX, event.touches[0].clientY)
  event.preventDefault()
}

function onMouseLeave() {
  pointerX = null
  pointerY = null
}

function onResize() {
  resize()
}

onMounted(() => {
  generate()
  resize()
  animationId = requestAnimationFrame(step)
  window.addEventListener('resize', onResize)
  const canvas = canvasRef.value
  if (canvas) {
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onMouseLeave)
  }
  document.addEventListener('mouseleave', onMouseLeave)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onMouseLeave)
  }
  document.removeEventListener('mouseleave', onMouseLeave)
})
</script>

<template>
  <div class="demo-wrapper">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-image: linear-gradient(-225deg, #231557 0%,
    #43107a 29%, #FF1361 100%);
}

canvas {
  position: fixed;
  width: 100%;
  height: 100%;
}
</style>
