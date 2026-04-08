<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
let rafId
let stars = []
let cx, cy, mx = 0, my = 0

const cfg = {
  numStars: 10000,
  focalLength: 0,
  mouseInfluence: 0.2,
  speed: 1,
  maxStarSize: 5,
  fadeStartZ: 200,
  fadeEndZ: 100
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const c = canvas.getContext("2d")
  cfg.focalLength = canvas.width * 2

  const init = () => {
    cx = canvas.width / 2
    cy = canvas.height / 2
    stars = Array.from({ length: cfg.numStars }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      z: Math.random() * canvas.width,
      o: '0.' + Math.floor(Math.random() * 99) + 1,
      px: 0,
      py: 0,
      pz: 0
    }))
  }

  const pos = (x, y, z) => {
    const scale = cfg.focalLength / z
    return {
      x: (x - cx) * scale + cx,
      y: (y - cy) * scale + cy,
      size: Math.min(cfg.maxStarSize, scale)
    }
  }

  const alpha = (z) => {
    if (z <= cfg.fadeStartZ) {
      return Math.max(0, Math.min(1, (z - cfg.fadeEndZ) / (cfg.fadeStartZ - cfg.fadeEndZ)))
    }
    return 1
  }

  const move = () => {
    stars.forEach(star => {
      [star.px, star.py, star.pz] = [star.x, star.y, star.z]
      star.z -= cfg.speed
      star.x += mx * cfg.mouseInfluence / star.z
      star.y += my * cfg.mouseInfluence / star.z
      if (star.z <= cfg.fadeEndZ) {
        const newX = Math.random() * canvas.width
        const newY = Math.random() * canvas.height
        star.px = star.x
        star.py = star.y
        star.pz = star.z
        star.z = canvas.width
        star.x = newX
        star.y = newY
      }
    })
  }

  const draw = () => {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      cfg.focalLength = canvas.width * 2
      init()
    }
    c.fillStyle = "rgb(0,10,20)"
    c.fillRect(0, 0, canvas.width, canvas.height)
    stars.forEach(star => {
      const curr = pos(star.x, star.y, star.z)
      const a = alpha(star.z)
      if (cfg.speed > 10) {
        const prev = pos(star.px, star.py, star.pz)
        c.beginPath()
        c.moveTo(prev.x, prev.y)
        c.lineTo(curr.x, curr.y)
        c.strokeStyle = `rgba(255, 255, 255, ${0.3 * a})`
        c.lineWidth = curr.size
        c.stroke()
      }
      c.beginPath()
      c.arc(curr.x, curr.y, curr.size, 0, Math.PI * 2)
      c.fillStyle = `rgba(255, 255, 255, ${parseFloat(star.o) * a})`
      c.fill()
    })
  }

  const loop = () => {
    move()
    draw()
    rafId = requestAnimationFrame(loop)
  }

  const mousemoveHandler = (e) => {
    mx = e.clientX - cx
    my = e.clientY - cy
  }

  const wheelHandler = (e) => {
    cfg.speed = Math.max(0.1, Math.min(50, cfg.speed - e.deltaY * 0.01))
  }

  document.addEventListener('mousemove', mousemoveHandler)
  document.addEventListener('wheel', wheelHandler)

  init()
  loop()

  return () => {
    cancelAnimationFrame(rafId)
    document.removeEventListener('mousemove', mousemoveHandler)
    document.removeEventListener('wheel', wheelHandler)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="demo-wrapper">
    <canvas ref="canvasRef" id="space"></canvas>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
}

* {
  padding: 0;
  margin: 0;
}

canvas {
  display: block;
}
</style>
