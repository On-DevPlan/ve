<script setup>
import { onMounted, onUnmounted } from 'vue'

function handleScroll() {
  const wh = window.innerHeight
  const sectionBlocks = document.querySelectorAll('.box-block')
  sectionBlocks.forEach(el => {
    const { bottom, top } = el.getBoundingClientRect()
    if (bottom <= 0 || top >= wh) return
    const y = document.documentElement.scrollTop * 0.5
    el.style.backgroundPosition = `center -${y}px`
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="demo-wrapper">
    <section class="box">
      <div class="box-block"></div>
      <div class="box-text">
        <div class="text-title">八月长安《暗恋》</div>
        <div class="text-desc">每朵云都下落不明，每盏月亮都不知所踪。</div>
      </div>
    </section>

    <section class="box">
      <div class="box-block"></div>
      <div class="box-text">
        <div class="text-title">八月长安《暗恋》</div>
        <div class="text-desc">每朵云都下落不明，每盏月亮都不知所踪。</div>
      </div>
    </section>

    <section class="box">
      <div class="box-block"></div>
      <div class="box-text">
        <div class="text-title">八月长安《暗恋》</div>
        <div class="text-desc">每朵云都下落不明，每盏月亮都不知所踪。</div>
      </div>
    </section>

    <section class="box">
      <div class="box-block"></div>
      <div class="box-text">
        <div class="text-title">八月长安《暗恋》</div>
        <div class="text-desc">每朵云都下落不明，每盏月亮都不知所踪。</div>
      </div>
    </section>

    <section class="box">
      <div class="box-block"></div>
      <div class="box-text">
        <div class="text-title">八月长安《暗恋》</div>
        <div class="text-desc">每朵云都下落不明，每盏月亮都不知所踪。</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0;
}

html {
  scroll-snap-type: y mandatory;
}

section {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.box {
  width: 100vw;
  height: 100vh;
  position: relative;
  display: flex;
  overflow: hidden;
}

.box-block {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: 120%;
  background-repeat: no-repeat;
  background-position: center 0;
  transform: translate3d(0, 0, 0);
  will-change: background-position;
}

.box:nth-child(1n) .box-block {
  background-image: url('/gost/No75_ScrollParallax/18.jpg');
}

.box:nth-child(2n) .box-block {
  background-image: url('/gost/No75_ScrollParallax/13.jpg');
  background-position: 1000px 1100px;
}

.box:nth-child(3n) .box-block {
  background-image: url('/gost/No75_ScrollParallax/20.jpg');
}

.box:nth-child(4n) .box-block {
  background-image: url('/gost/No75_ScrollParallax/21.jpg');
}

.box:nth-child(5n) .box-block {
  background-image: url('/gost/No75_ScrollParallax/26.jpg');
}

.box-block::before {
  position: absolute;
  top: 0;
  left: 0;
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.35);
  transition: background-color 0.3s ease;
}

.box:hover .box-block::before {
  background-color: rgba(0, 0, 0, 0.2);
}

.box-text {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #F1F1F1;
}

.box-text .text-title {
  font-size: 34px;
  margin-bottom: 20px;
}
</style>
