<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const clockRef = ref(null)
let animationId = null

let digitGroups = []

function initClock() {
  const _time10 = Array.from(Array(10)).map((n, i) => i)
  const _time6 = _time10.slice(0, 6)
  const _time3 = _time10.slice(0, 3)
  const _Structure = [
    [_time3, _time10],
    [_time6, _time10],
    [_time6, _time10]
  ]

  const clock = document.createElement('div')
  clock.id = 'clock'
  digitGroups = []

  _Structure.forEach(digits => {
    const digitGroup = document.createElement('div')
    digitGroup.classList.add('digit-group')
    clock.appendChild(digitGroup)
    digitGroups.push(digitGroup)

    digits.forEach(digitList => {
      const digit = document.createElement('div')
      digit.classList.add('digit')

      digitList.forEach(n => {
        const ele = document.createElement('div')
        ele.classList.add('digit-number')
        ele.innerText = n
        digit.appendChild(ele)
      })

      digitGroup.appendChild(digit)
    })
  })

  if (clockRef.value) {
    clockRef.value.appendChild(clock)
  }
}

function update() {
  animationId = requestAnimationFrame(update)

  const date = new Date()
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(n => `0${n}`.slice(-2).split('').map(e => +e))
    .reduce((p, n) => p.concat(n), [])

  time.forEach((n, i) => {
    const dg = digitGroups[Math.floor(i * 0.5)]
    if (!dg) return
    const digit = dg.children[i % 2]
    if (!digit) return
    const children = digit.children
    Array.from(children).forEach((e, i2) => {
      if (i2 === n) {
        e.classList.add('bright')
      } else {
        e.classList.remove('bright')
      }
    })
  })
}

onMounted(() => {
  initClock()
  animationId = requestAnimationFrame(update)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<template>
  <div class="demo-wrapper" ref="clockRef">
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
  background-image: linear-gradient(to right, #b8cbb8 0%,
      #b8cbb8 0%, #b465da 0%, #cf6cc9 33%, #ee609c 66%, #ee609c 100%);
}

#clock {
  font-size: 24px;
  width: 350px;
  height: 350px;
  position: absolute;
  left: 50%;
  top: 50%;
  margin-left: -175px;
  margin-top: -175px;
}

.digit-group {
  display: inline-block;
  height: 350px;
}

.digit-group:not(:last-child):after {
  content: ":";
  font-size: 72px;
}

.digit {
  display: inline-block;
  width: 50px;
  height: 350px;
}

.digit .digit-number {
  color: rgba(255, 255, 255, 0.5);
  transform: rotate(-90deg);
  transition: font-size 200ms, transform 350ms, color 150ms;
}

.digit .digit-number.bright {
  color: inherit;
  font-size: 72px;
  transform: rotate(0deg);
}
</style>
