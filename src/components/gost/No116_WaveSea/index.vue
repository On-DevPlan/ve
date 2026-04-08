<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const randColor = () => `rgba(${Math.random() * 50 + 50}, ${Math.random() * 100 + 150}, ${Math.random() * 50 + 200}, ${(Math.random() * 0.3 + 0.2).toFixed(2)})`
  const randDuration = () => `${(Math.random() * 20 + 3).toFixed(1)}s`
  const randPos = (i) => ({ x: Math.random() * 100 - 50, y: -5 - i * 3 + Math.random() * 8 - 4 })

  const container = document.getElementById('waves-container')
  if (!container) return

  const svgNS = "http://www.w3.org/2000/svg"

  Array.from({ length: 20 }, (_, i) => {
    const { x, y } = randPos(i)
    const wave = {
      x, y,
      fill: randColor(),
      opacity: `${Math.floor(Math.random() * 70 + 5)}%`,
      duration: randDuration()
    }
    const use = document.createElementNS(svgNS, "use")
    use.setAttribute("href", "#wave")
    use.setAttribute("x", wave.x)
    use.setAttribute("y", wave.y)
    use.setAttribute("fill", wave.fill)
    use.setAttribute("opacity", wave.opacity)

    const animate = document.createElementNS(svgNS, "animateMotion")
    animate.setAttribute("dur", wave.duration)
    animate.setAttribute("repeatCount", "indefinite")
    const mpath = document.createElementNS(svgNS, "mpath")
    mpath.setAttribute("href", "#wave-path")
    animate.appendChild(mpath)
    use.appendChild(animate)
    container.appendChild(use)
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <svg viewBox="0 0 1000 400" preserveAspectRatio="none" fill="currentColor">
      <path id="wave" d="M 0 2000 0 300 Q 120 220 300 300 t 300 0 300 0 300 0 300 0 300 0 v400 z" />
      <path id="wave-path" d="M -600 0 0 0" />
      <g id="waves-container"></g>
    </svg>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #000;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

svg {
  border: none;
  width: 100vw;
  height: 60vh;
  position: absolute;
  bottom: 0;
}
</style>
