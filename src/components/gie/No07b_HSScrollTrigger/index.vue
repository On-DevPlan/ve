<template>
  <div class="demo-wrapper">
    <div class="empty">KEEP SCROLL</div>
    <div class="empty">KEEP SCROLL</div>
    <div class="wapper" ref="wapperRef">
      <div class="container">
        <div class="cardsbox" ref="cardsboxRef">
          <div class="cardsbox_card">KEEP SCROLL</div>
          <div class="cardsbox_card">KEEP SCROLL</div>
          <div class="cardsbox_card">KEEP SCROLL</div>
          <div class="cardsbox_card">KEEP SCROLL</div>
        </div>
      </div>
    </div>
    <div class="empty">KEEP SCROLL</div>
    <div class="empty">KEEP SCROLL</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const wapperRef = ref(null)
const cardsboxRef = ref(null)

let lenis = null
let ifLeave = false

const resize = () => {
  if (!wapperRef.value || !cardsboxRef.value) return
  const distance = cardsboxRef.value.offsetWidth - window.innerWidth
  wapperRef.value.style.height = `${distance}px`
  if (ifLeave) {
    cardsboxRef.value.style.transform = `translateX(-${distance}px)`
  }
}

const initScrollTrigger = () => {
  if (!wapperRef.value || !cardsboxRef.value) return
  const distance = cardsboxRef.value.offsetWidth - window.innerWidth

  ScrollTrigger.create({
    trigger: wapperRef.value,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      cardsboxRef.value.style.transform = `translateX(-${self.progress * distance}px)`
    },
    onLeave: () => {
      ifLeave = true
    },
    onEnterBack: () => {
      ifLeave = false
    }
  })
}

onMounted(() => {
  lenis = new Lenis({
    duration: 1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    autoRaf: true,
  })

  resize()
  initScrollTrigger()

  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  if (lenis) {
    lenis.destroy()
  }
  ScrollTrigger.getAll().forEach(t => t.kill())
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.demo-wrapper {
  width: 100vw;
  background-color: #171717;
}

.empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 80rem;
  margin: 10rem 0;
  background-color: #f7f7f7;
  font-family: impact;
  font-size: 5rem;
  color: #171717;
}

.wapper {
  position: relative;
  width: 100%;
}

.container {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100vh;
  background-color: #17f700;
  overflow: hidden;
}

.cardsbox {
  display: flex;
  align-items: center;
  height: 100vh;
  flex-shrink: 0;
}

.cardsbox_card {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 70rem;
  height: 50rem;
  background-color: #f7f7f7;
  margin-right: 50rem;
  font-family: impact;
  font-size: 5rem;
  color: #171717;
  flex-shrink: 0;
}
</style>
