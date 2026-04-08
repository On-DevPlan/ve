<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const eyeContainerRef = ref(null)
const eyes = ref([])

onMounted(() => {
  const eyeContainer = eyeContainerRef.value
  if (!eyeContainer) return

  // Create 81 eyes
  for (let i = 0; i < 81; i++) {
    const eye = document.createElement('div')
    const pupil = document.createElement('div')
    eye.className = 'eye'
    pupil.className = 'pupil'
    eye.appendChild(pupil)
    eyeContainer.appendChild(eye)
  }

  eyes.value = document.querySelectorAll('.eye')

  const pointermoveHandler = (e) => {
    eyes.value.forEach((eye) => {
      const pupil = eye.querySelector('.pupil')
      const eyeRect = eye.getBoundingClientRect()
      const eyeCenterX = eyeRect.left + eyeRect.width / 2
      const eyeCenterY = eyeRect.top + eyeRect.height / 2
      const dx = (e.clientX - eyeCenterX) / eyeRect.width
      const dy = (e.clientY - eyeCenterY) / eyeRect.height
      const distance = Math.sqrt(dx * dx + dy * dy)
      const maxDistance = 0.9
      const clampedDistance = Math.min(distance, maxDistance)
      const angle = Math.atan2(dy, dx)
      const pupilX = Math.cos(angle) * clampedDistance * (eyeRect.width / 2 - pupil.offsetWidth / 2)
      const pupilY = Math.sin(angle) * clampedDistance * (eyeRect.height / 2 - pupil.offsetHeight / 2)
      pupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`
      const shadowOffsetX = pupilX / 4
      const shadowOffsetY = pupilY / 2
      const shadowBlur = 10
      eye.style.boxShadow = `inset ${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, 0.4)`
    })
  }

  const pointerleaveHandler = () => {
    eyes.value.forEach((eye) => {
      const pupil = eye.querySelector('.pupil')
      pupil.style.transform = 'translate(0, 0)'
      eye.style.boxShadow = 'inset 0px 0px 10px rgba(0, 0, 0, 0.4)'
    })
  }

  document.body.addEventListener('pointermove', pointermoveHandler)
  document.body.addEventListener('pointerleave', pointerleaveHandler)

  return () => {
    document.body.removeEventListener('pointermove', pointermoveHandler)
    document.body.removeEventListener('pointerleave', pointerleaveHandler)
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="eye-container" ref="eyeContainerRef"></div>
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
  background: #4154ff;
}

* {
  padding: 0;
  margin: 0;
}

.eye-container {
  width: 600px;
  height: 600px;
  position: relative;
  display: grid;
  grid-template: repeat(9, 1fr) / repeat(9, 1fr);
}

.eye {
  width: 60px;
  height: 60px;
  background-color: #fff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 0 10px #000 inset 0px 0px 10px rgba(0, 0, 0, 0.3);
  transition: box-shadow 0.2s ease-out;
}

.pupil {
  width: 25px;
  height: 25px;
  background-color: #000000;
  border-radius: 50%;
  position: relative;
  transition: transform 0.2s ease-out;
}
</style>
