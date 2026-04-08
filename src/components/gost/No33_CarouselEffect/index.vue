<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const imagesRef = ref(null)
let index = 0
let time = null

function position() {
  if (imagesRef.value) {
    imagesRef.value.style.left = (index * -100) + '%'
  }
}

function add() {
  if (index >= 2) {
    index = 0
  } else {
    index++
  }
}

function desc() {
  if (index < 1) {
    index = 2
  } else {
    index--
  }
}

function timer() {
  time = setInterval(() => {
    index++
    desc()
    add()
    position()
  }, 3000)
}

function handleLeftClick() {
  desc()
  position()
  clearInterval(time)
  timer()
}

function handleRightClick() {
  add()
  position()
  clearInterval(time)
  timer()
}

function handleMinClick(i) {
  index = i
  position()
  clearInterval(time)
  timer()
}

onMounted(() => {
  timer()
})

onUnmounted(() => {
  if (time) clearInterval(time)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <ul class="images" ref="imagesRef">
        <li class="img"></li>
        <li class="img"></li>
        <li class="img"></li>
      </ul>
      <ul class="min-images">
        <li class="min" @click="handleMinClick(0)"></li>
        <li class="min" @click="handleMinClick(1)"></li>
        <li class="min" @click="handleMinClick(2)"></li>
      </ul>
      <div class="button">
        <div class="button-left" @click="handleLeftClick">&lt;</div>
        <div class="button-right" @click="handleRightClick">&gt;</div>
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
  background-color: rgb(170, 190, 250);
  display: flex;
  align-items: center;
  justify-content: center;
}
.shell {
  width: 900px;
  height: 500px;
  position: relative;
  overflow-x: hidden;
  border-radius: 5px;
  border: 10px #fff solid;
  box-shadow: 20px 30px 20px rgba(0,0,0,.5);
}
.images {
  width: 300%;
  height: 100%;
  display: flex;
  position: absolute;
  left: 0;
  transition: .2s;
}
.img {
  width: 100%;
  background-size: cover;
}
.img:nth-child(1) {
  background-image: url("/gost/No33_CarouselEffect/1.jpg");
}
.img:nth-child(2) {
  background-image: url("/gost/No33_CarouselEffect/2.jpg");
}
.img:nth-child(3) {
  background-image: url("/gost/No33_CarouselEffect/3.jpg");
}
.min-images {
  display: flex;
  justify-content: space-evenly;
  position: absolute;
  bottom: 20px;
  width: 40%;
  z-index: 999;
  right: 10%;
}
.min {
  width: 60px;
  height: 60px;
  cursor: pointer;
  border-radius: 50%;
  background-size: cover;
  border: solid 5px rgba(255,255,255,0.5);
  background-position: -20px 0;
}
.min:nth-child(1) {
  background-image: url("/gost/No33_CarouselEffect/1.jpg");
}
.min:nth-child(2) {
  background-image: url("/gost/No33_CarouselEffect/2.jpg");
}
.min:nth-child(3) {
  background-image: url("/gost/No33_CarouselEffect/3.jpg");
}
.button {
  width: 100%;
  height: 100%;
  position: absolute;
  display: flex;
  justify-content: space-between;
  user-select: none;
}
.button-left,
.button-right {
  font-size: 50px;
  background-color: rgba(160,190,255,0.7);
  padding: 0 20px;
  line-height: 500px;
  cursor: pointer;
}
</style>
