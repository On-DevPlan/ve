<template>
  <div class="demo-wrapper">
    <div class="loading" :class="{ loading_out: loaded }">
      <svg viewbox="0 0 50 50">
        <circle r="25" cx="25" cy="25"></circle>
      </svg>
      <p>LOADING</p>
    </div>
    <p class="title" @click="triggerJump">
      PAGE <span>1</span>
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const loaded = ref(false)

const triggerJump = () => {
  if (!loaded.value) return
  loaded.value = false
  setTimeout(() => {
    loaded.value = true
  }, 1000)
}

onMounted(() => {
  setTimeout(() => {
    loaded.value = true
  }, 1500)
})
</script>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #171717;
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading {
  position: fixed;
  display: flex;
  flex-direction: column;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: #f7f7f7;
  z-index: 100;
  transition: 1s ease;
  justify-content: center;
  align-items: center;
}

.loading svg {
  width: 5rem;
  margin-bottom: 2rem;
  overflow: visible;
  transition: 0.3s ease;
}

.loading svg circle {
  fill: none;
  stroke: #171717;
  stroke-width: 12;
  stroke-dasharray: 160;
  stroke-dashoffset: 160;
  transform-origin: center;
  animation: circle_rotate 3s ease-in infinite;
}

@keyframes circle_rotate {
  0% { transform: rotate(0deg); stroke-dashoffset: 160; }
  100% { transform: rotate(360deg); stroke-dashoffset: -160; }
}

.loading p {
  font-family: sans-serif;
  font-size: 2rem;
  color: #171717;
  font-weight: 900;
  transition: 0.3s ease;
}

.loading_out {
  transform: translateY(100%);
}

.loading_out svg,
.loading_out p {
  opacity: 0;
}

.title {
  font-family: sans-serif;
  font-size: 10rem;
  color: #17f700;
  font-weight: 900;
  cursor: pointer;
  user-select: none;
}

.title span {
  font-size: 10rem;
  color: #f7f7f7;
}
</style>
