<template>
  <div class="demo-wrapper">
    <div class="shell">
      <span class="blob"></span>
      <span class="blob"></span>
      <span class="blob"></span>
      <span class="blob"></span>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
}

* {
  box-sizing: border-box;
}

.shell {
  display: grid;
  position: relative;
  animation: spin infinite 5s linear;
  grid-area: stack;
}

.blob {
  --border-radius: 115% 140% 145% 110% / 125% 140% 110% 125%;
  aspect-ratio: 1;
  display: block;
  grid-area: stack;
  background-repeat: no-repeat;
  background-position: center;
  border: 80px solid transparent;
  border-radius: var(--border-radius, 50%);
  mask-image: linear-gradient(transparent, transparent), linear-gradient(black, white);
  mask-clip: padding-box, border-box;
  mask-composite: intersect;
  mix-blend-mode: screen;
  height: 700px;
  filter: blur(100px);
}

.blob:nth-child(1) {
  background-color: #07D;
  background-image: linear-gradient(#07D, #3CC, #07D);
  rotate: 30deg;
  scale: 1.03;
}

.blob:nth-child(2) {
  background-color: #F43;
  background-image: linear-gradient(#F43, #F81, #F43);
  rotate: 60deg;
  scale: 0.95;
}

.blob:nth-child(3) {
  background-color: #3A7;
  background-image: linear-gradient(#3A7, #1F7, #3A7);
  rotate: 90deg;
  scale: 0.97;
}

.blob:nth-child(4) {
  background-color: #B1C;
  background-image: linear-gradient(#B1C, #814, #B1C);
  rotate: 120deg;
  scale: 1.02;
}

@keyframes spin {
  from {
    rotate: 0deg;
  }
  to {
    rotate: 360deg;
  }
}
</style>
