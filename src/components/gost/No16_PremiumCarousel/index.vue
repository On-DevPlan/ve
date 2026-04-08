<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const carouselRef = ref(null)
const mainImage = ref('')
let time
let index = 0

const resetItems = () => {
  const items = carouselRef.value?.querySelectorAll('.d') || []
  items.forEach(item => {
    item.className = 'd'
  })
}

const selectItem = () => {
  resetItems()
  const items = carouselRef.value?.querySelectorAll('.d') || []
  if (items[index]) {
    items[index].className = 'd dd'
  }
}

const startCarousel = () => {
  time = setInterval(() => {
    selectItem()
    mainImage.value = `/gost/No16_PremiumCarousel/${index + 1}.jpg`
    index++
    if (index === 5) {
      index = 0
    }
  }, 1500)
}

const handleMouseMove = (i) => {
  mainImage.value = `/gost/No16_PremiumCarousel/${i + 1}.jpg`
  clearInterval(time)
  index = i + 1
  startCarousel()
}

onMounted(() => {
  mainImage.value = '/gost/No16_PremiumCarousel/1.jpg'
  startCarousel()
})

onUnmounted(() => {
  clearInterval(time)
})
</script>

<template>
  <div class="demo-wrapper" ref="carouselRef">
    <div class="a">
      <div class="b" :style="{ backgroundImage: `url('${mainImage}')` }"></div>
      <div class="c">
        <div class="d dd" @mousemove="handleMouseMove(0)"><img src="/gost/No16_PremiumCarousel/1.jpg" alt=""></div>
        <div class="d" @mousemove="handleMouseMove(1)"><img src="/gost/No16_PremiumCarousel/2.jpg" alt=""></div>
        <div class="d" @mousemove="handleMouseMove(2)"><img src="/gost/No16_PremiumCarousel/3.jpg" alt=""></div>
        <div class="d" @mousemove="handleMouseMove(3)"><img src="/gost/No16_PremiumCarousel/4.jpg" alt=""></div>
        <div class="d" @mousemove="handleMouseMove(4)"><img src="/gost/No16_PremiumCarousel/5.jpg" alt=""></div>
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
  background-color: rgba(206, 182, 182, 0.637);
  display: flex;
  justify-content: center;
  align-items: center;
}
.a {
  position: relative;
  width: 650px;
  display: flex;
  justify-content: space-evenly;
}
.b {
  width: 400px;
  height: 500px;
  transition: .4s;
  background-size: cover;
  background-position: center;
}
.c {
  width: 200px;
  height: 500px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.d {
  position: relative;
  width: 200px;
  height: 90px;
  right: 0;
  transition: .5s;
  overflow: hidden;
  cursor: pointer;
}
.d img {
  position: absolute;
  width: 200px;
  transform: translate(0, -50px);
  transition: .5s;
  right: 0;
}
.d.dd {
  opacity: 0;
  right: 250px;
}
.d:hover img {
  opacity: 0;
  right: 250px;
}
</style>
