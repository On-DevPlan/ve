<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
let animationId = null
let intervalId = null

function dist(p1x, p1y, p2x, p2y) {
  return Math.sqrt(Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2))
}

class segment {
  constructor(parent, l, a, first) {
    this.first = first
    if (first) {
      this.pos = { x: parent.x, y: parent.y }
    } else {
      this.pos = { x: parent.nextPos.x, y: parent.nextPos.y }
    }
    this.l = l
    this.ang = a
    this.nextPos = {
      x: this.pos.x + this.l * Math.cos(this.ang),
      y: this.pos.y + this.l * Math.sin(this.ang),
    }
  }
  update(t) {
    this.ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x)
    this.pos.x = t.x + this.l * Math.cos(this.ang - Math.PI)
    this.pos.y = t.y + this.l * Math.sin(this.ang - Math.PI)
    this.nextPos.x = this.pos.x + this.l * Math.cos(this.ang)
    this.nextPos.y = this.pos.y + this.l * Math.sin(this.ang)
  }
  fallback(t) {
    this.pos.x = t.x
    this.pos.y = t.y
    this.nextPos.x = this.pos.x + this.l * Math.cos(this.ang)
    this.nextPos.y = this.pos.y + this.l * Math.sin(this.ang)
  }
  show(c) {
    c.lineTo(this.nextPos.x, this.nextPos.y)
  }
}

class tentacle {
  constructor(x, y, l, n, a) {
    this.x = x
    this.y = y
    this.l = l
    this.n = n
    this.t = {}
    this.rand = Math.random()
    this.segments = [new segment(this, this.l / this.n, 0, true)]
    for (let i = 1; i < this.n; i++) {
      this.segments.push(new segment(this.segments[i - 1], this.l / this.n, 0, false))
    }
  }
  move(last_target, target) {
    this.angle = Math.atan2(target.y - this.y, target.x - this.x)
    this.dt = dist(last_target.x, last_target.y, target.x, target.y)
    this.t = {
      x: target.x - 0.8 * this.dt * Math.cos(this.angle),
      y: target.y - 0.8 * this.dt * Math.sin(this.angle)
    }
    if (this.t.x) {
      this.segments[this.n - 1].update(this.t)
    } else {
      this.segments[this.n - 1].update(target)
    }
    for (let i = this.n - 2; i >= 0; i--) {
      this.segments[i].update(this.segments[i + 1].pos)
    }
    if (dist(this.x, this.y, target.x, target.y) <= this.l + dist(last_target.x, last_target.y, target.x, target.y)) {
      this.segments[0].fallback({ x: this.x, y: this.y })
      for (let i = 1; i < this.n; i++) {
        this.segments[i].fallback(this.segments[i - 1].nextPos)
      }
    }
  }
  show(c, target) {
    if (dist(this.x, this.y, target.x, target.y) <= this.l) {
      c.globalCompositeOperation = 'lighter'
      c.beginPath()
      c.moveTo(this.x, this.y)
      for (let i = 0; i < this.n; i++) {
        this.segments[i].show(c)
      }
      c.strokeStyle = 'hsl(' + (this.rand * 60 + 180) + ',100%,' + (this.rand * 60 + 25) + '%)'
      c.lineWidth = this.rand * 2
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.stroke()
      c.globalCompositeOperation = 'source-over'
    }
  }
  show2(c, target) {
    c.beginPath()
    if (dist(this.x, this.y, target.x, target.y) <= this.l) {
      c.arc(this.x, this.y, 2 * this.rand + 1, 0, 2 * Math.PI)
      c.fillStyle = 'white'
    } else {
      c.arc(this.x, this.y, this.rand * 2, 0, 2 * Math.PI)
      c.fillStyle = 'darkcyan'
    }
    c.fill()
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const c = canvas.getContext('2d')
  let w = canvas.width = window.innerWidth
  let h = canvas.height = window.innerHeight

  c.fillStyle = 'rgba(30,30,30,1)'
  c.fillRect(0, 0, w, h)

  const mouse = { x: false, y: false }
  const last_mouse = {}

  const maxl = 400
  const minl = 50
  const n = 30
  const numt = 600
  const tent = []
  let clicked = false
  let target = { x: 0, y: 0 }
  const last_target = {}
  let t = 0
  const q = 10

  for (let i = 0; i < numt; i++) {
    tent.push(new tentacle(
      Math.random() * w,
      Math.random() * h,
      Math.random() * (maxl - minl) + minl,
      n,
      Math.random() * 2 * Math.PI
    ))
  }

  function draw() {
    if (mouse.x) {
      target.errx = mouse.x - target.x
      target.erry = mouse.y - target.y
    } else {
      target.errx = w / 2 + ((h / 2 - q) * Math.sqrt(2) * Math.cos(t)) / (Math.pow(Math.sin(t), 2) + 1) - target.x
      target.erry = h / 2 + ((h / 2 - q) * Math.sqrt(2) * Math.cos(t) * Math.sin(t)) / (Math.pow(Math.sin(t), 2) + 1) - target.y
    }
    target.x += target.errx / 10
    target.y += target.erry / 10
    t += 0.01

    c.beginPath()
    c.arc(target.x, target.y, dist(last_target.x, last_target.y, target.x, target.y) + 5, 0, 2 * Math.PI)
    c.fillStyle = 'hsl(210,100%,80%)'
    c.fill()

    for (let i = 0; i < numt; i++) {
      tent[i].move(last_target, target)
      tent[i].show2(c, target)
    }
    for (let i = 0; i < numt; i++) {
      tent[i].show(c, target)
    }
    last_target.x = target.x
    last_target.y = target.y
  }

  function loop() {
    animationId = requestAnimationFrame(loop)
    c.clearRect(0, 0, w, h)
    draw()
  }

  const handleResize = () => {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight
    loop()
  }

  const handleMouseMove = (e) => {
    last_mouse.x = mouse.x
    last_mouse.y = mouse.y
    mouse.x = e.pageX - canvas.offsetLeft
    mouse.y = e.pageY - canvas.offsetTop
  }

  const handleMouseLeave = () => {
    mouse.x = false
    mouse.y = false
  }

  window.addEventListener('resize', handleResize)
  canvas.addEventListener('mousemove', handleMouseMove, false)
  canvas.addEventListener('mouseleave', handleMouseLeave)

  loop()
  intervalId = setInterval(loop, 1000 / 60)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (intervalId) clearInterval(intervalId)
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
  background: rgb(0, 0, 0);
}

canvas {
  display: block;
}
</style>
