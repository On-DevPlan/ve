<template>
  <div class="demo-wrapper">
    <canvas class="photobox" ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)

const IMG_TOTAL = 28
const ROW_MAX = 7
const LINE_MAX = 4
const IMG_WIDTH = Math.floor(700 / 2)
const IMG_HEIGHT = Math.floor(1000 / 2)
const IMG_MARGIN = 200

let ctx = null
let imgData = []
let ifMovable = false
let totalWidth = 0
let totalHeight = 0

const init = () => {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')

  totalWidth = ROW_MAX * (IMG_WIDTH + IMG_MARGIN) - IMG_MARGIN
  totalHeight = LINE_MAX * (IMG_HEIGHT + IMG_MARGIN) - IMG_MARGIN

  canvas.width = canvas.clientWidth
  canvas.height = canvas.clientHeight

  imgData = []
  for (let i = 0; i < IMG_TOTAL; i++) {
    const img = new Image()
    img.src = `/gie/No08b_InfiniteScrollCanvas/photo (${i + 1}).png`
    img.onload = () => {
      const colIndex = i % ROW_MAX
      const lineIndex = Math.floor(i / ROW_MAX)
      const x = colIndex * (IMG_WIDTH + IMG_MARGIN)
      const y = lineIndex * (IMG_HEIGHT + IMG_MARGIN)
      imgData.push({ img, x, y })
      ctx.drawImage(img, x, y, IMG_WIDTH, IMG_HEIGHT)
    }
  }

  canvas.addEventListener('mousedown', () => { ifMovable = true })
  canvas.addEventListener('mouseup', (e) => {
    ifMovable = false
    checkImg(e.clientX, e.clientY)
  })
  canvas.addEventListener('mouseleave', () => { ifMovable = false })
  canvas.addEventListener('mousemove', (e) => {
    if (!ifMovable) return
    moveImgs(e.movementX, e.movementY)
  })
}

const moveImgs = (dx, dy) => {
  if (!ctx || !canvasRef.value) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  imgData.forEach((item) => {
    item.x += dx
    if (item.x > totalWidth - IMG_WIDTH) item.x -= totalWidth + IMG_MARGIN
    if (item.x < -IMG_WIDTH) item.x += totalWidth + IMG_MARGIN

    item.y += dy
    if (item.y > totalHeight - IMG_HEIGHT) item.y -= totalHeight + IMG_MARGIN
    if (item.y < -IMG_HEIGHT) item.y += totalHeight + IMG_MARGIN

    ctx.drawImage(item.img, item.x, item.y, IMG_WIDTH, IMG_HEIGHT)
  })
}

const checkImg = (x, y) => {
  const found = imgData.find(item =>
    x >= item.x && x < item.x + IMG_WIDTH &&
    y >= item.y && y < item.y + IMG_HEIGHT
  )
  if (found) console.log(found, found.img)
}

const handleResize = () => {
  if (!canvasRef.value) return
  canvasRef.value.width = canvasRef.value.clientWidth
  canvasRef.value.height = canvasRef.value.clientHeight
  if (imgData.length) moveImgs(0, 0)
}

onMounted(() => {
  init()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
* {
  padding: 0;
  margin: 0;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  background-color: #171717;
  overflow: hidden;
}

.photobox {
  position: absolute;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
