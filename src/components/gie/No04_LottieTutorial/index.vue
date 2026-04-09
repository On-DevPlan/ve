<template>
  <div class="demo-wrapper">
    <div id="animation_box"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const containerRef = ref(null)
let lottieInstance = null

onMounted(() => {
  // Load lottie.js from public
  const script = document.createElement('script')
  script.src = '/gie/No04_LottieTutorial/lottie.js'
  script.onload = initLottie
  document.head.appendChild(script)
})

function initLottie() {
  if (!containerRef.value) return

  // Find the box element after mount
  const animationBox = document.getElementById('animation_box')
  if (!animationBox) return

  lottieInstance = lottie.loadAnimation({
    container: animationBox,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    path: '/gie/No04_LottieTutorial/welcome.json'
  })

  let readystate = 0
  setTimeout(() => { readystate = 1 }, 5000)

  lottieInstance.addEventListener('enterFrame', () => {
    if (lottieInstance.currentFrame >= 65) {
      if (readystate !== 1) {
        lottieInstance.goToAndPlay(0)
      }
    }
  })

  lottieInstance.addEventListener('complete', () => {
    containerRef.value?.classList.add('container_hidden')
  })
}

onUnmounted(() => {
  if (lottieInstance) {
    lottieInstance.destroy()
  }
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
  transform: translateY(100%);
  visibility: hidden;
  transition: 0.8s ease;
}

.demo-wrapper.container_hidden {
  transform: translateY(100%);
  visibility: hidden;
}

#animation_box {
  position: relative;
  width: 50rem;
}
</style>
