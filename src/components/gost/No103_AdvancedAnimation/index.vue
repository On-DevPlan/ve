<script setup>
import { ref, onMounted } from 'vue'

const gridRef = ref(null)

onMounted(() => {
  const gridElement = gridRef.value?.querySelector('.grid')
  if (!gridElement) return

  let htmlCode = ''
  for (let i = 0; i < 110; i++) {
    let rowStartDelay = -0.2 * Math.floor(i / 10)
    let delay = rowStartDelay + -0.22 * (i % 10)
    htmlCode += `<i style="--delay:${delay}s;"></i>`
  }
  gridElement.innerHTML = htmlCode
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="scene" ref="gridRef">
      <div class="grid"></div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: grid;
  place-items: center;
  background-color: #000;
  color: #ffffff;
  perspective: 800px;
}

* {
  transform-style: preserve-3d;
}

.scene {
  position: relative;
  animation: scene 40s infinite linear;
}

@keyframes scene {
  from {
    transform: rotateX(45deg) rotateZ(0deg);
  }
  to {
    transform: rotateX(45deg) rotateZ(360deg);
  }
}

.grid {
  position: absolute;
  inset: -10em;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 1.5em;
}

.grid i {
  position: relative;
  width: 100%;
  height: 100%;
  animation: i 5s var(--delay, 0s) infinite linear;
}

@keyframes i {
  from {
    transform: rotate(0deg) rotateX(30deg);
  }
  to {
    transform: rotate(360deg) rotateX(30deg);
  }
}

.grid i::before,
.grid i::after {
  content: "";
  position: absolute;
  top: -950%;
  width: 120%;
  height: 2000%;
  transform: rotateX(90deg);
  border-radius: 50%;
  background-image: linear-gradient(#000000, rgb(6, 255, 118));
}

.grid i::after {
  transform: rotateX(90deg) rotateY(90deg);
}
</style>
