<template>
  <div class="demo-wrapper">
    <div class="button" :class="buttonClass" @click="toggle">
      <p class="button_text">STROKE</p>
      <svg class="button_icon" viewBox="0 0 283.9 425.8">
        <line class="button_icon_straight" x1="141.9" y1="-0.1" x2="141.9" y2="283.8" />
        <line class="button_icon_bias" x1="0" y1="141.9" x2="283.9" y2="425.8" />
        <line class="button_icon_bias" x1="283.9" y1="141.9" x2="0" y2="425.8" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isArrow = ref(true)

const buttonClass = () => isArrow.value ? 'button_arrow' : 'button_cross'

const toggle = () => {
  isArrow.value = !isArrow.value
}
</script>

<style scoped>
* {
  padding: 0;
  margin: 0;
  font-size: 5vmin;
}

.demo-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: #171717;
}

.button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.3rem 1rem;
  border: 0.05rem solid #f7f7f7;
  border-radius: 2rem;
  cursor: pointer;
}

.button_text {
  font-family: impact;
  font-size: 1.2rem;
  color: #17f700;
  letter-spacing: 0.05rem;
  margin-right: 0.5rem;
}

.button_icon {
  width: 0.9rem;
  fill: none;
  stroke: #17f700;
  stroke-width: 15;
  transition: transform 0.8s ease;
  transform: translateY(15%);
}

.button_icon_straight,
.button_icon_bias {
  transition: stroke-dasharray 0.6s ease;
}

.button_arrow .button_icon_straight {
  stroke-dasharray: 50 50 200;
}

.button_arrow .button_icon_bias {
  stroke-dasharray: 205 300 205 300;
}

.button_arrow:hover .button_icon_straight {
  stroke-dasharray: 150 50 200;
}

.button_cross .button_icon {
  transform: translateY(-15%);
}

.button_cross .button_icon_straight {
  stroke-dasharray: 0 300;
}

.button_cross .button_icon_bias {
  stroke-dasharray: 0 0 400 0;
}

.button_cross:hover .button_icon_bias {
  stroke-dasharray: 20 60 240 60 20;
}
</style>
