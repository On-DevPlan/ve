<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const sliderRef = ref(null)
const bodyRef = ref(document.body)
const images = [
  '01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg',
  '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg'
]

let width = 0
let height = 0
let totalWidth = 0
const margin = 20
let currIndex = ref(5)
let interval = null
const intervalTime = 3000

const imageBase = '/gost/No84_CarouselTimeline'

function padNum(n) {
  return n.toString().padStart(2, '0')
}

function resize() {
  width = Math.max(window.innerWidth * 0.2, 275)
  height = window.innerHeight * 0.5
  totalWidth = width * images.length

  if (sliderRef.value) {
    sliderRef.value.style.width = totalWidth + 'px'
  }

  const items = document.querySelectorAll('.item')
  items.forEach(item => {
    item.style.width = (width - margin * 2) + 'px'
    item.style.height = height + 'px'
  })
}

function move(index) {
  if (index < 1) index = images.length
  if (index > images.length) index = 1
  currIndex.value = index

  const items = document.querySelectorAll('.item')
  const slider = sliderRef.value

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const frame = item.querySelector('.frame')
    if (i === index - 1) {
      item.classList.add('item--active')
      frame.style.transform = 'perspective(1200px)'
    } else {
      item.classList.remove('item--active')
      frame.style.transform = 'perspective(1200px) rotateY(' + (i < index - 1 ? 40 : -40) + 'deg)'
    }
  }

  if (slider) {
    slider.style.transform = 'translate3d(' + ((index * -width) + (width / 2) + window.innerWidth / 2) + 'px, 0, 0)'
  }

  const frontBox = items[index - 1]?.querySelector('.front')
  if (frontBox && frontBox.style.backgroundImage) {
    document.body.style.backgroundImage = frontBox.style.backgroundImage
  }
}

function timer() {
  clearInterval(interval)
  interval = setInterval(() => {
    move(++currIndex.value)
  }, intervalTime)
}

function prev() {
  move(--currIndex.value)
  timer()
}

function next() {
  move(++currIndex.value)
  timer()
}

function handleResize() {
  resize()
}

onMounted(() => {
  const items = document.querySelectorAll('.item')
  items.forEach((item, i) => {
    const frame = item.querySelector('.frame')
    const frontBox = frame.querySelector('.front')
    const leftBox = frame.querySelector('.left')
    const rightBox = frame.querySelector('.right')
    const num = padNum(i + 1)
    const url = `url(${imageBase}/${num}.jpg)`
    frontBox.style.backgroundImage = url
    leftBox.style.backgroundImage = url
    rightBox.style.backgroundImage = url
  })

  resize()
  move(Math.floor(items.length / 2))
  timer()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  clearInterval(interval)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="shell_body">
        <div class="button">
          <div class="prev" @click="prev">
            <span class="iconfont icon-backward_filled"></span>
          </div>
          <div class="next" @click="next">
            <span class="iconfont icon-forward_filled"></span>
          </div>
        </div>
        <div class="shell_slider" ref="sliderRef">
          <div class="item" v-for="(img, i) in images" :key="i">
            <div class="frame">
              <div class="box front">
                <h1>2014</h1>
                <span>-In the year 2014 I reached the age of 13-</span>
              </div>
              <div class="box left"></div>
              <div class="box right"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400&display=swap');

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background: rgba(99, 99, 99, 0.8);
  font-family: 'Source Sans Pro', sans-serif;
}

* {
  padding: 0;
  margin: 0;
}

.shell {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: rgba(99, 99, 99, 0.8);
}

.button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 350px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 150px;
  z-index: 99999;
}

.prev,
.next {
  transition: transform 0.25s ease;
  cursor: pointer;
}

.prev i,
.next i {
  font-size: 60px;
  color: #fff;
  cursor: pointer;
  text-shadow: 0 0 10px #ffffff;
}

.shell_body {
  width: 100%;
  padding: 20px 0 150px 0;
}

.shell_slider {
  position: relative;
  transition: transform 1s ease-in-out;
  background: transparent;
  display: flex;
}

.item {
  position: relative;
  float: left;
  margin: 0 20px;
}

.frame {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 1s ease-in-out;
  transform-style: preserve-3d;
}

.frame:after {
  content: '';
  position: absolute;
  bottom: -16%;
  width: 100%;
  height: 60px;
  background: #ffffff1c;
  box-shadow: 0px 0px 15px 5px #ffffff1c;
  transform: rotateX(90deg) translate3d(0px, -20px, 0px);
}

.box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4px solid #fff;
  perspective: 1000px;
  transform-style: preserve-3d;
  background-size: cover;
}

.box h1,
.box span {
  color: #fff;
  transform: translateZ(20px);
}

.box h1 {
  text-shadow: 0 0 30px #1f05b4;
  font-size: 100px;
}

.box span {
  position: absolute;
  bottom: 20px;
  padding: 0 25px;
  text-shadow: 0 0 10px #1f05b4;
}

.front,
.left,
.right {
  box-shadow: 0 0 50px #ffffff;
  background-size: cover;
}

.right,
.left {
  top: 0;
  width: 60px;
  backface-visibility: hidden;
}

.left {
  left: 0;
  border-left-width: 5px;
  transform: translate3d(1px, 0, -60px) rotateY(-90deg);
  transform-origin: 0%;
}

.right {
  right: 0;
  border-right-width: 5px;
  transform: translate3d(-1px, 0, -60px) rotateY(90deg);
  transform-origin: 100%;
}

.iconfont {
  font-family: 'iconfont' !important;
  font-size: 60px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.icon-backward_filled:before { content: '\e6e0'; }
.icon-forward_filled:before { content: '\e6e2'; }
</style>
