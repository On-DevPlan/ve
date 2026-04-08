<script setup>
import { ref, onMounted } from 'vue'

const pos = ref(50)

onMounted(() => {
  const range = document.querySelector('#range')
  if (range) {
    range.addEventListener('input', function () {
      document.body.style.setProperty('--pos', this.value + '%')
    })
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="compare">
      <section class="before">
        <img src="/gost/No101_ImageSlider/05.png" alt="" />
      </section>
      <section class="after">
        <img src="/gost/No101_ImageSlider/06.png" alt="" />
      </section>
      <input type="range" id="range">
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
  justify-content: center;
  background-image: url(/gost/No101_ImageSlider/background.png);
  background-size: cover;
}

* {
  padding: 0;
  margin: 0;
}

.compare {
  display: grid;
}

.compare * {
  width: 800px;
  grid-area: 1 / 1;
}

.compare section {
  display: grid;
  place-content: center;
}

.before {
  clip-path: inset(0 calc(100% - var(--pos, 50%)) 0 0);
}

.after {
  clip-path: inset(0 0 0 var(--pos, 50%));
}

#range {
  z-index: 1;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

#range::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 100vh;
  background-image: linear-gradient(to bottom,
      #91defe,
      #99c0f9,
      #bdb6ec,
      #d7b3e3,
      #efb3d5,
      #f9bccc);
}
</style>
