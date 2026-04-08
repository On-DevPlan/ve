<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const backgroundRef = ref(null)

const handleScroll = () => {
  const background = backgroundRef.value
  if (!background) return
  const scrollY = window.scrollY

  if (scrollY !== 0) {
    background.style.backgroundPosition = `calc(50% + ${scrollY}px) calc(50% + ${scrollY}px)`
  } else {
    background.style.backgroundPosition = ''
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="demo-wrapper" @scroll="handleScroll">
    <h1>bilibili<br />山羊の前端小窝</h1>
    <div class="background" ref="backgroundRef"><span>Goat</span></div>
    <h2>
      In winter, it is covered with snow and snow. When you climb to Jinding, you can see far and wide, and the
      scenery is very magnificent; West overlooking Aiai snow peak, Gongga Mountain and Wawu mountain, the mountains
      connect the sky; Looking south at the top of Ten Thousand Buddhas, the clouds are rolling and the momentum is
      magnificent; A panoramic view of the Pingchuan River in the north is as beautiful as a shop, with a panoramic
      view of the Dadu River and Qingyi River
    </h2>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 200vh;
  overflow-x: hidden;
  margin: 0;
}
html,
body {
  margin: 0;
  padding: 0;
  height: 200vh;
  overflow-x: hidden;
}
.background {
  background-image: url('https://picsum.photos/1920/1080?random=25');
  background-size: cover;
  background-position: 50% 50%;
  height: 200vh;
  font: 900 39rem '';
  line-height: 130vh;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  position: relative;
  text-align: center;
  overflow: hidden;
}

.background::before {
  content: '';
  background-size: cover;
  background-image: inherit;
  background-position: 50% 50%;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: -99;
}

h1 {
  position: fixed;
  text-align: center;
  width: 100%;
  letter-spacing: 10px;
  color: #fff;
  top: 0;
  z-index: 10;
}

h2 {
  position: fixed;
  letter-spacing: 2px;
  top: 120vh;
  width: 60%;
  color: #fff;
  left: 50%;
  transform: translateX(-50%);
  padding: 30px;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 10;
}
</style>
