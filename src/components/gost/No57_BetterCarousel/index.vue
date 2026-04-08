<script setup>
import { ref, onMounted } from 'vue'

const sliderRef = ref(null)
const slidesRef = ref(null)
const buttonRef = ref(null)

let current = 0
let prev = 4
let next = 1

const gotoPrev = () => current > 0 ? gotoNum(current - 1) : gotoNum(slidesRef.value.length - 1)
const gotoNext = () => current < 3 ? gotoNum(current + 1) : gotoNum(0)

const gotoNum = (number) => {
  current = number
  prev = current - 1
  next = current + 1
  for (let i = 0; i < slidesRef.value.length; i++) {
    slidesRef.value[i].classList.remove('active')
    slidesRef.value[i].classList.remove('prev')
    slidesRef.value[i].classList.remove('next')
  }
  if (next == 4) { next = 0 }
  if (prev == -1) { prev = 3 }
  slidesRef.value[current].classList.add('active')
  slidesRef.value[prev].classList.add('prev')
  slidesRef.value[next].classList.add('next')
}

onMounted(() => {
  const slider = document.querySelector('.shell')
  const slides = document.querySelectorAll('.item')
  const button = document.querySelectorAll('.button')
  sliderRef.value = slider
  slidesRef.value = slides
  buttonRef.value = button

  for (let i = 0; i < button.length; i++) {
    button[i].addEventListener('click', () => i == 0 ? gotoPrev() : gotoNext())
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="item active">
        <img src="/gost/No57_BetterCarousel/1.gif">
      </div>
      <div class="item next">
        <img src="/gost/No57_BetterCarousel/2.gif">
      </div>
      <div class="item">
        <img src="/gost/No57_BetterCarousel/3.gif">
      </div>
      <div class="item prev">
        <img src="/gost/No57_BetterCarousel/4.gif">
      </div>
      <div class="button-container">
        <div class="button"><i class="iconfont icon-xiangzuo"></i></div>
        <div class="button"><i class="iconfont icon-xiangyou"></i></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background: rgb(170, 190, 250);
  display: flex;
  justify-content: center;
  align-items: center;
}

.shell {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  user-select: none;
}

.shell .item {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 250px;
  height: 250px;
  border-radius: 50%;
  overflow: hidden;
  transition: all 0.3s ease-in-out;
  z-index: -1;
  opacity: 0;
  background-color: #fff;
}

.item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item.active {
  opacity: 1;
  z-index: 99;
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: 0px 0px 105px -35px rgba(0, 0, 0, 0.75);
}

.item.prev {
  z-index: 2;
  opacity: 0.25;
  transform: translate(-125%, -50%);
}

.item.next {
  z-index: 2;
  opacity: 0.25;
  transform: translate(25%, -50%);
}

.shell .button-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 315px;
  z-index: 100;
}

.button-container .button {
  color: #fff;
  font-size: 32px;
  cursor: pointer;
  position: relative;
  transition: all 300ms ease-in-out;
}

.button-container .button:before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  background-color: rgba(5, 5, 5, 0.521);
  border-radius: 50%;
  z-index: -99;
}

.iconfont {
  display: block;
}

.button-container .button:nth-child(1) {
  float: left;
}

.button-container .button:nth-child(2) {
  float: right;
}
</style>
