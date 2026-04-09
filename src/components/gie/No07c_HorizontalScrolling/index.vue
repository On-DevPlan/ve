<template>
  <div class="demo-wrapper">
    <div class="emptybox"> empty </div>
    <div class="emptybox"> empty </div>
    <div class="scrollbox" ref="scrollboxRef">
      <div class="scrollbox_container" ref="containerRef">
        <div class="scrollbox_container_card" v-for="i in 3" :key="i">
          <p>{{ ['card one', 'card two', 'card three'][i - 1] }}</p>
          <img class="scc_city" :class="`scc_city${i}`" :src="citySrc" />
          <img class="scc_truck" :class="`scc_truck${i}`" :src="truckSrc" />
        </div>
      </div>
    </div>
    <div class="emptybox"> empty </div>
    <div class="emptybox"> empty </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const citySrc = '/gie/No07c_HorizontalScrolling/city.svg'
const truckSrc = '/gie/No07c_HorizontalScrolling/truck.svg'

const scrollboxRef = ref(null)
const containerRef = ref(null)

let triggerDistance = 0
let borderDistance = 0

const move = () => {
  if (!scrollboxRef.value || !containerRef.value) return
  const cards = containerRef.value.querySelectorAll('.cardsbox_card') ||
    containerRef.value.querySelectorAll('.scrollbox_container_card')
  const trucks = containerRef.value.querySelectorAll('.scc_truck')
  const citys = containerRef.value.querySelectorAll('.scc_city')

  if (window.scrollY >= triggerDistance && window.scrollY <= borderDistance) {
    const distance = window.scrollY - triggerDistance
    containerRef.value.style.transform = `translateY(${distance}px)`
    const distanceX =
      distance / (borderDistance - triggerDistance) *
      (containerRef.value.offsetWidth - window.innerWidth)

    cards?.forEach((card, i) => {
      card.style.transform = `translateX(${-distanceX}px)`
    })
    trucks?.forEach((truck, i) => {
      truck.style.transform = `translateX(${distanceX * 1.2}px)`
    })
    citys?.forEach((city, i) => {
      city.style.transform = `translateX(${distanceX * 0.5}px)`
    })
  }
}

const resize = () => {
  if (!scrollboxRef.value || !containerRef.value) return
  scrollboxRef.value.style.height = `${containerRef.value.offsetWidth}px`
  triggerDistance = scrollboxRef.value.offsetTop
  borderDistance = scrollboxRef.value.offsetTop + scrollboxRef.value.offsetHeight - window.innerHeight
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('scroll', move, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('scroll', move)
})
</script>

<style scoped>
* {
  padding: 0;
  margin: 0;
}

.demo-wrapper {
  width: 100vw;
  background-color: #171717;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.emptybox {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 65rem;
  height: 40rem;
  background-color: #17f700;
  border-radius: 5rem;
  margin-bottom: 8rem;
  font-family: sans-serif;
  font-size: 8rem;
  color: #f7f7f7;
  font-weight: 900;
  text-transform: uppercase;
}

.scrollbox {
  display: flex;
  justify-content: start;
  align-items: start;
  width: 100%;
  overflow: hidden;
}

.scrollbox_container {
  display: flex;
  justify-content: start;
  height: 100vh;
  flex-shrink: 0;
}

.scrollbox_container_card {
  position: relative;
  width: 65rem;
  height: 40rem;
  background-color: #f7f7f7;
  border-radius: 5rem;
  margin-left: 5rem;
  flex-shrink: 0;
  overflow: hidden;
}

.scrollbox_container_card p {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: sans-serif;
  font-size: 6rem;
  color: #171717;
  font-weight: 900;
  text-transform: uppercase;
  z-index: 1;
}

.scc_city {
  position: absolute;
  bottom: 0;
  height: 100%;
  opacity: 0.7;
}

.scc_truck {
  position: absolute;
  bottom: 0;
  height: 6rem;
}

.scc_city1,
.scc_truck1 {
  left: 0;
}

.scc_city2,
.scc_truck2 {
  left: calc(-100% + -5rem);
}

.scc_city3,
.scc_truck3 {
  left: calc(-200% + -10rem);
}
</style>
