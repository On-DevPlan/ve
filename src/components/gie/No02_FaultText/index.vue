<template>
  <div class="demo-wrapper">
    <div class="container" @click="fault">
      <p v-for="i in 4" :key="i" class="faulttext" :class="{ faulting: isFaulting }">
        CONTEXT
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const isFaulting = ref(false)
let player = null

const fault = () => {
  clearInterval(player)
  setTimeout(() => {
    clearInterval(player)
    isFaulting.value = false
  }, 1000)

  isFaulting.value = true
  player = setInterval(() => {
    // clipPath is applied via CSS when faulting
  }, 30)
}

onUnmounted(() => {
  clearInterval(player)
})
</script>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.faulttext {
  position: absolute;
  font-family: Impact, sans-serif;
  font-size: 5rem;
  color: #fff;
  letter-spacing: 0.5rem;
  user-select: none;
  transform: translate(0, 0);
  clip-path: none;
}

.faulting.faulttext::after,
.faulting.faulttext::before {
  content: "CONTEXT";
  position: absolute;
  left: 0;
  top: 0;
  mix-blend-mode: screen;
}

.faulting.faulttext::after {
  color: #ff0000;
  transform: translateX(2%);
  animation: fault-anim 0.03s infinite;
}

.faulting.faulttext::before {
  color: #0000ff;
  transform: translateX(-2%);
  animation: fault-anim 0.03s infinite reverse;
}

@keyframes fault-anim {
  0%   { transform: translateX(-2%) translate(2px, 2px); clip-path: polygon(0% 0%, 40% 0%, 35% 50%, 0% 100%); }
  25%  { transform: translateX(2%) translate(-1px, 1px); clip-path: polygon(20% 10%, 80% 5%, 70% 60%, 15% 90%); }
  50%  { transform: translateX(-1%) translate(3px, -2px); clip-path: polygon(10% 30%, 90% 25%, 75% 80%, 5% 70%); }
  75%  { transform: translateX(3%) translate(-3px, 3px); clip-path: polygon(5% 50%, 95% 45%, 60% 95%, 30% 5%); }
  100% { transform: translateX(-2%) translate(1px, -1px); clip-path: polygon(30% 0%, 70% 10%, 50% 50%, 10% 100%); }
}
</style>
