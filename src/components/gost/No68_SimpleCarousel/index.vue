<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const slides = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const currentIndex = ref(0)
let timer = null

const prev = () => {
  clearInterval(timer)
  startTimer()
  if (currentIndex.value > 0) {
    currentIndex.value--
  } else {
    currentIndex.value = slides.length - 1
  }
}

const next = () => {
  clearInterval(timer)
  startTimer()
  if (currentIndex.value < slides.length - 1) {
    currentIndex.value++
  } else {
    currentIndex.value = 0
  }
}

const goTo = (index) => {
  clearInterval(timer)
  currentIndex.value = index
  startTimer()
}

const startTimer = () => {
  timer = setInterval(() => {
    if (currentIndex.value < slides.length - 1) {
      currentIndex.value++
    } else {
      currentIndex.value = 0
    }
  }, 2000)
}

onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="admin">
        <div class="a">
            <ul>
                <li
                    v-for="(slide, i) in slides"
                    :key="i"
                    class="b"
                    :class="{ bb: i === currentIndex }"
                ></li>
            </ul>
        </div>
        <div class="c" @click="prev">&lt;</div>
        <div class="d" @click="next">&gt;</div>
        <ul class="e1">
            <li
                v-for="(slide, i) in slides"
                :key="i"
                :data-x="i"
                class="e"
                :class="{ ee: i === currentIndex }"
                @click="goTo(i)"
            ></li>
        </ul>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    margin: 0;
    background-color: rgb(39, 35, 35);
    display: flex;
    justify-content: center;
    align-items: center;
}

.admin {
    width: 350px;
    height: 542px;
    position: relative;
    top: 60px;
}

li {
    list-style: none;
}

.b {
    width: 100%;
    height: 550px;
    position: absolute;
    background-size: cover;
    opacity: 0;
    transition: .5s;
}

.b:nth-child(1) { background-image: url('/gost/No68_SimpleCarousel/1.gif'); }
.b:nth-child(2) { background-image: url('/gost/No68_SimpleCarousel/2.gif'); }
.b:nth-child(3) { background-image: url('/gost/No68_SimpleCarousel/3.gif'); }
.b:nth-child(4) { background-image: url('/gost/No68_SimpleCarousel/4.gif'); }
.b:nth-child(5) { background-image: url('/gost/No68_SimpleCarousel/5.gif'); }
.b:nth-child(6) { background-image: url('/gost/No68_SimpleCarousel/6.gif'); }
.b:nth-child(7) { background-image: url('/gost/No68_SimpleCarousel/7.gif'); }
.b:nth-child(8) { background-image: url('/gost/No68_SimpleCarousel/8.gif'); }
.b:nth-child(9) { background-image: url('/gost/No68_SimpleCarousel/9.gif'); }

.b.bb {
    opacity: 1;
}

.c,
.d {
    width: 70px;
    height: 550px;
    background: rgba(207, 90, 211, .2);
    position: absolute;
    top: 0;
    line-height: 550px;
    text-align: center;
    font-size: 70px;
    color: blueviolet;
    cursor: pointer;
    user-select: none;
    transition: .3s;
}

.c:hover,
.d:hover {
    background-color: rgba(255, 255, 255, .6);
    color: #000;
}

.c {
    left: -70px;
}

.d {
    right: -70px;
}

.e1 {
    width: 95%;
    height: 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 10px;
    margin: auto;
}

.e {
    border-radius: 50%;
    border: #000 solid 5px;
    width: 15px;
    height: 15px;
    opacity: .7;
    cursor: pointer;
    transition: .4s;
}

.e:hover {
    opacity: 1;
    background-color: rgba(162, 59, 202, 0.7);
}

.e.ee {
    opacity: 1;
    background-color: rgb(46, 33, 158);
}
</style>
