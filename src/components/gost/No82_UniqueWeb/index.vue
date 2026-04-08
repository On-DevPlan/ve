<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const container = ref(null)
const imageCount = 99
const usedImages = []
const cards = ref([])
const isLoaded = ref(false)

function padNumber(number) {
  return number.toString().padStart(2, '0')
}

function getRandomImageIndex() {
  let randNum = Math.ceil(Math.random() * imageCount)
  while (usedImages.includes(randNum)) {
    randNum = Math.ceil(Math.random() * imageCount)
  }
  usedImages.push(randNum)
  return randNum
}

function createImage(data, randNum) {
  const hex = data[randNum - 1]?.hex || '#cccccc'
  return {
    id: randNum,
    imageUrl: `/gost/No82_UniqueWeb/${padNumber(randNum)}.jpg`,
    hex,
    style: {}
  }
}

function scatterCards() {
  cards.value.forEach((card) => {
    let rNum = Math.random() * 50 - 2
    rNum *= Math.floor(Math.random() * 2) === 1 ? 1 : -1
    let x = Math.random() * 50 - 5
    let y = Math.random() * 50 - 5
    x *= Math.floor(Math.random() * 2) === 1 ? 1 : -1
    y *= Math.floor(Math.random() * 2) === 1 ? 1 : -1
    card.style = {
      transform: `rotate(${rNum}deg)`,
      top: `${x}px`,
      left: `${y}px`
    }
  })
}

function show(index) {
  if (index < imageCount) {
    setTimeout(() => {
      if (cards.value[index]) {
        cards.value[index].visible = true
      }
      show(index + 1)
    }, 100)
  }
}

let dragState = {}

function handleMouseDown(e, card) {
  const startX = e.clientX
  const startY = e.clientY
  const origTop = parseFloat(card.style.top) || 0
  const origLeft = parseFloat(card.style.left) || 0

  dragState = { origTop, origLeft }

  function onMouseMove(e) {
    const diffX = e.clientX - startX
    const diffY = e.clientY - startY
    card.style = {
      ...card.style,
      top: `${origTop + diffY}px`,
      left: `${origLeft + diffX}px`
    }
  }

  function onMouseUp(e) {
    const diffX = e.clientX - startX
    const diffY = e.clientY - startY
    // Animate float away
    setTimeout(() => {
      card.style = {
        ...card.style,
        top: `${parseFloat(card.style.top) + diffY}px`,
        left: `${parseFloat(card.style.left) + diffX}px`
      }
    }, 0)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

onMounted(async () => {
  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/Margaret2/pantone-colors/master/pantone-colors.json'
    )
    const data = await res.json()
    for (let i = 0; i < imageCount; i++) {
      const randNum = getRandomImageIndex()
      cards.value.push(createImage(data, randNum))
    }
    scatterCards()
    show(0)
    isLoaded.value = true
  } catch (err) {
    console.error(err)
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="container" ref="container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card"
        :class="{ active: card.visible }"
        :style="card.style"
        @mousedown="handleMouseDown($event, card)"
      >
        <img :src="card.imageUrl" class="image" />
        <div class="color-codes">
          <h1>{{ card.id.toString().padStart(2, '0') }}</h1>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background: #f4d1cc;
  background-image: linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%);
}

.container {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  justify-content: center;
  overflow: hidden;
  min-height: 100vh;
  align-content: flex-start;
  padding: 10px;
}

h1 {
  margin-top: 15px;
  font: 600 16px '';
  color: #343434;
}

.image {
  transition: 0.3s;
  width: 100%;
  display: block;
}

.card {
  width: 150px;
  margin: 10px;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0px 0px 15px rgba(0, 0, 0, 0.1);
  text-align: center;
  background-color: #f9f9f9d8;
  position: relative;
  opacity: 0;
  cursor: grab;
  user-select: none;
}

.card:active {
  cursor: grabbing;
}

.card.active {
  opacity: 1;
}

.card:hover {
  box-shadow: 0px 0px 15px rgba(255, 255, 255, 0.3);
  background-color: #f9f9f9;
}
</style>
