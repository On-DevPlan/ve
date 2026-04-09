<template>
  <div class="demo-wrapper" ref="wrapperRef"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const wrapperRef = ref(null)

const LINES_TOTAL = 200
const SEGMENT_LENGTH = 0.3

let lines = []
let wavesData = null
let currentIndex = 0
let timer = null

const init = async () => {
  if (!wrapperRef.value) return

  for (let i = 0; i < LINES_TOTAL; i++) {
    const line = document.createElement('div')
    line.className = 'line'
    line.style.transform = `rotate(${360 / LINES_TOTAL * i}deg)`
    line.style.setProperty('--s', '0')
    wrapperRef.value.appendChild(line)
    lines.push(line)
  }

  wavesData = await getWavesData(SEGMENT_LENGTH, LINES_TOTAL)
  run()
}

const getWavesData = async (segmentLength, points) => {
  try {
    const response = await fetch('/gie/No17_AudioWave/audio.mp3')
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer)
    const rate = audioBuffer.sampleRate
    const duration = audioBuffer.duration
    const channelData = audioBuffer.getChannelData(0)

    const result = []
    const segments = Math.ceil(duration / segmentLength)

    for (let seg = 0; seg < segments; seg++) {
      const startTime = seg * segmentLength
      const endTime = Math.min(startTime + segmentLength, duration)
      if (startTime >= duration) break

      const startSample = Math.floor(startTime * rate)
      const endSample = Math.floor(endTime * rate)
      const pointSamples = Math.floor((endSample - startSample) / points)
      const pointsData = []

      for (let i = 0; i < points; i++) {
        const startSeg = startSample + i * pointSamples
        const endSeg = startSeg + pointSamples
        let sum = 0
        for (let j = startSeg; j < endSeg; j++) {
          sum += Math.abs(channelData[j] || 0)
        }
        pointsData.push(sum / pointSamples)
      }
      result.push(pointsData)
    }
    return result
  } catch (e) {
    console.error('Failed to load audio:', e)
    return []
  }
}

const run = () => {
  if (!wavesData || !wavesData.length) return
  timer = setInterval(() => {
    currentIndex = (currentIndex + 1) % (wavesData.length - 1)
    lines.forEach((line, i) => {
      line.style.setProperty('--s', wavesData[currentIndex][i])
    })
  }, 300)
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.demo-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: #171717;
  position: relative;
}

.line {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 50rem;
  height: 50rem;
}

.line::after {
  content: "";
  position: relative;
  width: 0.2rem;
  height: 8rem;
  background-color: #17f700;
  transform: scale(var(--s, 0));
  transition: transform 0.3s ease;
}
</style>
