<template>
  <div class="demo-wrapper">
    <div class="row" data_text="your name">
      <input
        class="row_input"
        if_finish="0"
        @focus="focusHandler"
        @blur="blurHandler"
      />
      <svg class="row_selectbox" width="125" height="92" viewBox="0 0 125 92">
        <path d="M19,21H85V87H19V21Z" />
        <path d="M14,42L40,78l71-64" />
      </svg>
    </div>
    <div class="row" data_text="your age">
      <input
        class="row_input"
        if_finish="0"
        @focus="focusHandler"
        @blur="blurHandler"
      />
      <svg class="row_selectbox" width="125" height="92" viewBox="0 0 125 92">
        <path d="M19,21H85V87H19V21Z" />
        <path d="M14,42L40,78l71-64" />
      </svg>
    </div>
    <div class="row" data_text="your gender">
      <input
        class="row_input"
        if_finish="0"
        @focus="focusHandler"
        @blur="blurHandler"
      />
      <svg class="row_selectbox" width="125" height="92" viewBox="0 0 125 92">
        <path d="M19,21H85V87H19V21Z" />
        <path d="M14,42L40,78l71-64" />
      </svg>
    </div>
    <div class="row" data_text="your email">
      <input
        class="row_input"
        if_finish="0"
        @focus="focusHandler"
        @blur="blurHandler"
      />
      <svg class="row_selectbox" width="125" height="92" viewBox="0 0 125 92">
        <path d="M19,21H85V87H19V21Z" />
        <path d="M14,42L40,78l71-64" />
      </svg>
    </div>
    <div class="hand" ref="handRef">
      <img :src="handSrc" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const handSrc = '/gie/No09_CheckableForm/hand.png'
const handRef = ref(null)

const timeline = gsap.timeline()
let offsetDistance = 0

const resize = () => {
  const referRect = document.querySelector('.row_selectbox')?.getBoundingClientRect()
  if (!referRect) return
  offsetDistance = referRect.height / 3
  if (handRef.value) {
    handRef.value.style.height = `${referRect.height * 5}px`
    handRef.value.style.left = `${referRect.left}px`
    handRef.value.style.top = `${referRect.top - handRef.value.offsetHeight / 2 + offsetDistance + window.scrollY}px`
  }
}

const focusHandler = (e) => {
  const axisY = e.target.getBoundingClientRect().top
  timeline.to(handRef.value, {
    top: `${axisY - handRef.value.offsetHeight / 2 + offsetDistance + window.scrollY}px`,
    duration: 0.4,
    ease: 'linear'
  })
}

const blurHandler = (e) => {
  const ifFinish = parseInt(e.target.getAttribute('if_finish'))
  const svg = e.target.nextElementSibling

  if (e.target.value !== '' && !ifFinish) {
    e.target.setAttribute('if_finish', '1')
    timeline.add(
      gsap.timeline()
        .to(handRef.value, {
          rotate: '5deg',
          x: '3%',
          y: '7%',
          duration: 0.2,
          ease: 'linear',
          onStart: () => svg?.classList.add('row_selectbox_finish')
        })
        .to(handRef.value, {
          rotate: '-2deg',
          x: '9%',
          y: '-6%',
          duration: 0.2,
          ease: 'linear'
        })
        .to(handRef.value, {
          rotate: 0,
          x: 0,
          y: 0,
          duration: 0.3,
          ease: 'linear'
        })
    )
  } else if (e.target.value === '' && ifFinish) {
    e.target.setAttribute('if_finish', '0')
    timeline.add(
      gsap.timeline()
        .to(handRef.value, {
          x: '-25%',
          y: '10%',
          duration: 0.3,
          ease: 'linear'
        })
        .to(handRef.value, {
          x: 0,
          y: 0,
          duration: 0.2,
          ease: 'linear',
          onStart: () => svg?.classList.remove('row_selectbox_finish')
        })
    )
  }
}

onMounted(() => {
  window.addEventListener('load', resize)
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('load', resize)
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
* {
  font-size: 2vmin;
  padding: 0;
  margin: 0;
}

.demo-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  width: 100vw;
  min-height: 100vh;
  padding-top: 10rem;
  background-color: #171717;
  overflow-x: hidden;
}

.row {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 50rem;
  margin-bottom: 10rem;
}

.row::after {
  content: attr(data_text);
  position: absolute;
  left: 0;
  top: -3.2rem;
  font-family: sans-serif;
  font-size: 1.8rem;
  color: #f7f7f7;
  text-transform: uppercase;
  transition: 0.3s ease;
}

.row:hover::after {
  color: #17f700;
}

.row_input {
  box-sizing: border-box;
  width: 80%;
  height: 4rem;
  border-radius: 5rem;
  background-color: #171717;
  border: #f7f7f7 0.2rem solid;
  outline: none;
  padding: 0 2rem;
  font-family: sans-serif;
  font-size: 1.5rem;
  color: #f7f7f7;
  transition: 0.3s ease;
  cursor: pointer;
}

.row_input:focus {
  border: #17f700 0.2rem solid;
}

.row_selectbox {
  width: 5rem;
  height: 5rem;
  fill: none;
}

.row_selectbox path:nth-child(1) {
  stroke: #f7f7f7;
  stroke-width: 6;
}

.row_selectbox path:nth-child(2) {
  stroke: #17f700;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 26;
  stroke-dasharray: 150;
  stroke-dashoffset: 150;
}

.row_selectbox_finish path:nth-child(2) {
  stroke-dashoffset: 0;
  transition: 0.5s ease;
}

.hand {
  position: absolute;
  pointer-events: none;
  transform-origin: left center;
}

.hand img {
  position: relative;
  height: 100%;
}

@media screen and (max-aspect-ratio: 1.2/1) {
  .row {
    width: 40rem;
    margin-bottom: 6rem;
  }
}
</style>
