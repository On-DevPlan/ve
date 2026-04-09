<template>
  <div class="demo-wrapper" ref="containerRef">
    <div class="photos" ref="photosRef">
      <div class="photos_line" v-for="lineIndex in 4" :key="lineIndex">
        <div
          class="photos_line_photo"
          v-for="photoIndex in getPhotoCount(lineIndex)"
          :key="photoIndex"
        >
          <img :src="`/gie/No08_InfiniteScrolling/photo (${getPhotoNum(lineIndex, photoIndex)}).png`" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const photosRef = ref(null)
const containerRef = ref(null)

const photoCounts = [7, 7, 7, 7]
const totalPhotos = 28

const getPhotoCount = (lineIndex) => photoCounts[lineIndex - 1]

const getPhotoNum = (lineIndex, photoIndex) => {
  const start = photoCounts.slice(0, lineIndex - 1).reduce((a, b) => a + b, 0)
  return start + photoIndex
}

let imgData = []
let ifMovable = false
let mouseX = 0
let mouseY = 0
let standardWidth = 1440
let scaleNums = 1
let containerWidth = 0
let containerHeight = 0
let photoWidth = 0
let photoHeight = 0
let gsapAnis = []

const resize = () => {
  if (!photosRef.value) return
  const photoEls = photosRef.value.querySelectorAll('.photos_line_photo')
  containerWidth = photosRef.value.offsetWidth
  containerHeight = photosRef.value.offsetHeight
  photoWidth = photoEls[0]?.offsetWidth || 0
  photoHeight = photoEls[0]?.offsetHeight || 0
  scaleNums = document.body.offsetWidth / standardWidth
  photosRef.value.style.transform = `scale(${scaleNums})`

  gsapAnis.forEach(ani => ani?.kill())
  gsapAnis = []
  imgData = []

  photoEls.forEach((img) => {
    gsap.to(img, { transform: 'translate(0,0)', duration: 0, ease: 'power4.out' })
    imgData.push({
      node: img,
      x: img.offsetLeft,
      y: img.offsetTop,
      movX: 0,
      movY: 0,
      ani: null
    })
  })
}

const move = (x, y) => {
  if (!ifMovable || !photosRef.value) return
  const distanceX = (x - mouseX) / scaleNums
  const distanceY = (y - mouseY) / scaleNums

  imgData.forEach((img) => {
    let duration = 1
    img.movX += distanceX
    if (img.x + img.movX > containerWidth) {
      img.movX -= containerWidth
      duration = 0
    }
    if (img.x + img.movX < -photoWidth) {
      img.movX += containerWidth
      duration = 0
    }
    img.movY += distanceY
    if (img.y + img.movY > containerHeight) {
      img.movY -= containerHeight
      duration = 0
    }
    if (img.y + img.movY < -photoHeight) {
      img.movY += containerHeight
      duration = 0
    }
    if (img.ani) img.ani.kill()
    img.ani = gsap.to(img.node, {
      transform: `translate(${img.movX}px,${img.movY}px)`,
      duration: duration,
      ease: 'power4.out'
    })
    gsapAnis.push(img.ani)
  })

  mouseX = x
  mouseY = y
}

const handleMouseDown = (e) => {
  ifMovable = true
  mouseX = e.clientX
  mouseY = e.clientY
}

const handleMouseUp = () => {
  ifMovable = false
}

const handleMouseLeave = () => {
  ifMovable = false
}

const handleMouseMove = (e) => {
  move(e.clientX, e.clientY)
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  photosRef.value?.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mouseleave', handleMouseLeave)
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mouseleave', handleMouseLeave)
  window.removeEventListener('mousemove', handleMouseMove)
  gsapAnis.forEach(ani => ani?.kill())
})
</script>

<style scoped>
* {
  padding: 0;
  margin: 0;
}

.demo-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: #171717;
  overflow: hidden;
}

.photos {
  position: absolute;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  transform-origin: center;
}

.photos_line {
  display: flex;
  height: 342em;
  margin-bottom: 48em;
  flex-shrink: 0;
}

.photos_line_photo {
  width: 234em;
  height: 100%;
  margin-right: 36em;
  border-radius: 15em;
  background-color: #17f700;
  overflow: hidden;
  flex-shrink: 0;
}

.photos_line_photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.photos_line_photo:hover img {
  transform: scale(1.2);
}

@media screen and (max-aspect-ratio: 1.5/1) {
  .photos_line,
  .photos_line_photo {
    font-size: 2px;
  }
}

@media screen and (max-aspect-ratio: 0.8/1) {
  .photos_line,
  .photos_line_photo {
    font-size: 2.8px;
  }
}
</style>
