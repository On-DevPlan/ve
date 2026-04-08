<script setup>
import { ref, onMounted } from 'vue'

let offset = 0
const maxOffset = 0
const minOffset = -3

onMounted(() => {
  const slides = Array.from(document.querySelectorAll(".card"))
  const clock = document.querySelector("#clock-table")
  const startYear = 2021

  for (let i = -60, year = startYear - 1; i < 300; i += 6) {
    addClockScale(i)
    if (i % 60 === 0) {
      addThickClockScale(i, year)
      year++
    }
  }
})

function addClockScale(degree) {
  const clock = document.querySelector("#clock-table")
  if (!clock) return
  const invisibleClockTable = document.createElement("div")
  invisibleClockTable.className = "invisible-table"
  invisibleClockTable.style.transform = `rotate(${degree}deg)`
  const clockScale = document.createElement("div")
  clockScale.className = "clock-scale"
  invisibleClockTable.appendChild(clockScale)
  clock.appendChild(invisibleClockTable)
}

function addThickClockScale(degree, time) {
  const clock = document.querySelector("#clock-table")
  if (!clock) return
  const invisibleClockTable = document.createElement("div")
  invisibleClockTable.className = "invisible-table"
  invisibleClockTable.style.transform = `rotate(${degree}deg)`
  const thickClockScale = document.createElement("div")
  thickClockScale.className = "clock-thick"
  const scaleContent = document.createElement("span")
  scaleContent.textContent = `${time}`
  thickClockScale.appendChild(scaleContent)
  invisibleClockTable.appendChild(thickClockScale)
  clock.appendChild(invisibleClockTable)
}

const slideToPrev = () => {
  offset = Math.min(maxOffset, offset + 1)
  document.querySelectorAll(".card").forEach(slide => {
    slide.style.transform = `translateY(${offset * 100}%)`
  })
  const clock = document.querySelector("#clock-table")
  if (clock) clock.style.transform = `rotate(${offset * 60}deg)`
}

const slideToNext = () => {
  offset = Math.max(minOffset, offset - 1)
  document.querySelectorAll(".card").forEach(slide => {
    slide.style.transform = `translateY(${offset * 100}%)`
  })
  const clock = document.querySelector("#clock-table")
  if (clock) clock.style.transform = `rotate(${offset * 60}deg)`
}
</script>

<template>
  <div class="demo-wrapper">
    <div class="main">
      <i class="iconfont icon-arrow-up-bold" id="up-btn" @click="slideToPrev">&lt;</i>
      <i class="iconfont icon-arrow-down-bold" id="down-btn" @click="slideToNext">&gt;</i>
      <div id="content">
        <div class="card">
          <div class="card-time">2021</div>
          <div class="card-title">《你的孤独，虽败犹荣》</div>
          <div class="card-passage">
            如果你停止，就是谷底。如果你还在继续，就是上坡。
          </div>
        </div>
        <div class="card">
          <div class="card-time">2022</div>
          <div class="card-title">《萤火之森》</div>
          <div class="card-passage">
            如果时光可以倒流，我还是会选择认识你。
          </div>
        </div>
        <div class="card">
          <div class="card-time">2023</div>
          <div class="card-title">《平凡的世界》</div>
          <div class="card-passage">
            人生啊，是这样不可预测，没有永恒的痛苦，也没有永恒的幸福。
          </div>
        </div>
        <div class="card">
          <div class="card-time">2024</div>
          <div class="card-title">《道林・格雷的画像》</div>
          <div class="card-passage">
            不要虚掷你的黄金时代，不要去倾听枯燥乏味的东西。
          </div>
        </div>
      </div>
      <div id="clock">
        <div id="clock-center"></div>
        <div id="clock-pointer"></div>
        <div id="clock-table"></div>
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
}

* {
  margin: 0;
  padding: 0;
}

.main {
  width: 100vw;
  height: 100vh;
  display: flex;
  position: relative;
  background-color: #5053fc;
  overflow: hidden;
}

.iconfont {
  width: 80px;
  height: 80px;
  position: absolute;
  left: 27%;
  z-index: 999;
  font: 900 80px '';
  color: #fff;
  cursor: pointer;
}

#up-btn {
  top: 5%;
}

#down-btn {
  bottom: 5%;
}

#content {
  width: 30%;
  height: 100%;
  position: absolute;
  left: 15%;
  overflow: hidden;
}

.card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: white;
  transition: transform .8s ease-in-out;
}

.card-time {
  font-size: 40px;
  font-weight: 700;
}

.card-title {
  font-size: 50px;
  font-weight: 500;
  padding-bottom: 10px;
  border-bottom: 1px solid white;
  margin-bottom: 10px;
}

.card-passage {
  font-size: 24px;
  font-weight: 300;
}

#clock {
  height: 130%;
  aspect-ratio: 1 / 1;
  position: absolute;
  right: -28%;
  top: -15%;
  border-radius: 50%;
  background-color: white;
  border: #ff9214 30px solid;
}

@media(max-width:1000px) {
  #clock {
    right: -90%;
  }
}

#clock-table {
  width: 96%;
  height: 96%;
  border-radius: 50%;
  position: absolute;
  top: 2%;
  left: 2%;
  transition: transform .8s ease-in-out;
}

.invisible-table {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  transform-origin: 50% 50%;
  position: absolute;
}

.clock-thick {
  width: 6%;
  height: 6px;
  background-color: #5053fc;
  position: absolute;
  top: calc(50% - 3px);
  left: 0px;
}

.clock-thick span {
  font-size: 50px;
  position: absolute;
  left: 140%;
  top: calc(50% - 30px);
  color: #5053fc;
}

.clock-scale {
  width: 4%;
  height: 2px;
  background-color: #5053fc;
  position: absolute;
  top: calc(50% - .5px);
  left: 0px;
}
</style>
