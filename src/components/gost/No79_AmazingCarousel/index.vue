<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const shellRef = ref(null)
let selectedIndex = 0
const cellCount = 23
const theta = 360 / cellCount
let radius = 0

function rotateshell() {
  if (!shellRef.value) return
  const angle = theta * selectedIndex * -1
  shellRef.value.style.transform = 'translateZ(' + -radius + 'px) ' + 'rotateX(' + -angle + 'deg)'

  const cellIndex = selectedIndex < 0
    ? (cellCount - ((selectedIndex * -1) % cellCount))
    : (selectedIndex % cellCount)

  const cells = shellRef.value.querySelectorAll('.box')
  cells.forEach((cell, index) => {
    if (cellIndex === index) {
      cell.classList.add('selected')
    } else {
      cell.classList.remove('selected')
    }
  })
}

function selectPrev() {
  selectedIndex--
  rotateshell()
}

function selectNext() {
  selectedIndex++
  rotateshell()
}

function initshell() {
  if (!shellRef.value) return
  const cellWidth = shellRef.value.offsetWidth
  const cellHeight = shellRef.value.offsetHeight
  const cellSize = cellHeight
  radius = Math.round((cellSize / 1.8) / Math.tan(Math.PI / cellCount))

  const cells = shellRef.value.querySelectorAll('.box')
  cells.forEach((cell, i) => {
    const cellAngle = theta * i
    cell.style.transform = 'rotateX(' + -cellAngle + 'deg) translateZ(' + radius + 'px)'
  })

  rotateshell()
}

let resizeObserver = null

onMounted(() => {
  setTimeout(() => {
    initshell()

    resizeObserver = new ResizeObserver(() => {
      initshell()
    })
    if (shellRef.value) {
      resizeObserver.observe(shellRef.value)
    }
  }, 100)
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="carousel">
        <ol class="boxs" ref="shellRef">
          <li class="box" v-for="i in 23" :key="i">
            <img src="/gost/No79_AmazingCarousel/01.jpg" alt="">
          </li>
        </ol>
      </div>
      <div class="arrows">
        <button class="up" @click="selectPrev">
          <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M541.866667 298.666667a42.666667 42.666667 0 0 1 30.149333 72.96L388.352 512h247.466666a42.666667 42.666667 0 0 1 30.149334 72.96L541.866667 725.333333a42.666667 42.666667 0 0 1-60.330667 0L358.186667 601.6a42.666667 42.666667 0 0 1 0-60.330667L481.536 417.626667a42.666667 42.666667 0 0 1 60.330667-118.826667z"/>
          </svg>
        </button>
        <button class="next" @click="selectNext">
          <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M482.133333 725.333333a42.666667 42.666667 0 0 1-30.149333 72.96L328.618667 657.6a42.666667 42.666667 0 0 1 0-60.330667L451.968 473.6a42.666667 42.666667 0 0 1 60.330667 60.330667L388.352 512h247.466666a42.666667 42.666667 0 0 1 30.149334 72.96L541.866667 725.333333a42.666667 42.666667 0 0 1-59.733334 0z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(to top, #9795f0 0%, #fbc8d4 100%);
}

.shell {
  display: flex;
  align-items: center;
  position: relative;
  padding: 130px 0;
}

.carousel {
  position: relative;
  width: 520px;
  height: 500px;
  padding-top: 150px;
  perspective: 300px;
}

.arrows {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 10px;
  position: absolute;
  right: 15px;
}

.up,
.next {
  margin: 5px 0;
  padding: 5px;
  width: 50px;
  height: 50px;
  border: 3px solid rgb(255, 255, 255);
  border-radius: 10px;
  background-color: #ffffff61;
  color: #fff;
  transition: .3s;
  cursor: pointer;
}

.up:hover,
.next:hover {
  background-color: #fff;
  color: #9795f0;
}

.icon {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.boxs {
  width: 100%;
  height: 210px;
  position: absolute;
  transform-style: preserve-3d;
  transition: 1s;
}

.box {
  position: absolute;
  width: 520px;
  height: 200px;
  border: 2px solid white;
  border-radius: 10px;
  overflow: hidden;
  opacity: .7;
}

.box img {
  width: 100%;
  transform: translateY(-50px);
}

.box.selected {
  border-color: goldenrod;
  border-width: 5px;
  opacity: 1;
}
</style>
