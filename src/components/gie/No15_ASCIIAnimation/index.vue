<template>
  <div class="demo-wrapper">
    <pre class="asciibox" ref="asciiboxRef"></pre>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { parseGIF, decompressFrames } from 'gifuct-js'

const asciiboxRef = ref(null)

const SCALE_NUMS = 6
const LEVELS = [['0', '1'], ['.', '-'], [' ']]

let texts = []
let currentIndex = 0
let timer = null

const createTexts = (data, width, height) => {
  let text = ''
  for (let y = 0; y < height; y += SCALE_NUMS) {
    let row = ''
    for (let x = 0; x < width; x += SCALE_NUMS) {
      const i = (y * width + x) * 4
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      const level = LEVELS[Math.floor(avg / 255 * (LEVELS.length - 1))]
      const char = level[parseInt(Math.random() * level.length)]
      row += char
    }
    text += row + '\n'
  }
  texts.push(text)
}

const init = async () => {
  try {
    const resp = await fetch('/gie/No15_ASCIIAnimation/ascii.gif')
    const buff = await resp.arrayBuffer()
    const gif = parseGIF(buff)
    const frames = decompressFrames(gif, true)

    const width = gif.lsd.width
    const height = gif.lsd.height

    frames.forEach(frame => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = frame.dims.width
      canvas.height = frame.dims.height
      const imageData = new ImageData(frame.patch, frame.dims.width, frame.dims.height)
      ctx.putImageData(imageData, 0, 0)
      createTexts(ctx.getImageData(0, 0, width, height).data, width, height)
    })

    if (asciiboxRef.value) {
      asciiboxRef.value.innerText = texts[0]
    }

    timer = setInterval(() => {
      currentIndex = (currentIndex + 1) % (texts.length - 1)
      if (asciiboxRef.value) {
        asciiboxRef.value.innerText = texts[currentIndex]
      }
    }, 60)
  } catch (e) {
    console.error('Failed to load ASCII animation:', e)
  }
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
  position: relative;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100dvh;
  background-color: #171717;
  overflow: hidden;
}

.asciibox {
  font-size: 1rem;
  color: #17f700;
  line-height: 1.5rem;
  letter-spacing: 1rem;
}
</style>
