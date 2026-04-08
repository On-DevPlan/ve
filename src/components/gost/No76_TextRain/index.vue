<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const cloudRef = ref(null)
let rainInterval = null

function randomText() {
  const text = '唱跳篮球'
  const letter = text[Math.floor(Math.random() * text.length)]
  return letter
}

function rain() {
  if (!cloudRef.value) return
  const e = document.createElement('div')
  const left = Math.floor(Math.random() * 310)
  const size = Math.random() * 1.5
  const duration = Math.random() * 1
  const text = randomText()
  e.classList.add('text')
  e.innerText = text
  e.style.left = left + 'px'
  e.style.fontSize = 0.5 + size + 'em'
  e.style.animationDuration = 1 + duration + 's'
  cloudRef.value.appendChild(e)
  setTimeout(() => {
    if (cloudRef.value && cloudRef.value.contains(e)) {
      cloudRef.value.removeChild(e)
    }
  }, 2000)
}

onMounted(() => {
  rainInterval = setInterval(rain, 20)
})

onUnmounted(() => {
  if (rainInterval) clearInterval(rainInterval)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="cloud" ref="cloudRef"></div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(to top, #9795f0 0%, #fbc8d4 100%);
}

.shell {
  position: relative;
  height: 560px;
  -webkit-box-reflect: below 1px linear-gradient(transparent, transparent,
      transparent, transparent, #0005);
}

.cloud {
  position: relative;
  top: 50px;
  width: 320px;
  height: 300px;
  background-image: url(/gost/No76_TextRain/01.png);
  background-size: cover;
}

.text {
  position: absolute;
  top: 250px;
  line-height: 20px;
  color: #fff;
  text-shadow: 0 0 5px #fff,
    0 0 15px #fff,
    0 0 30px #fff;
  animation: rain 1s linear forwards;
}

@keyframes rain {
  0% {
    transform: translateY(0) scale(1);
  }

  80% {
    transform: translateY(230px) scale(1);
  }

  100% {
    transform: translateY(220px) scale(1.3);
    opacity: 0;
  }
}
</style>
