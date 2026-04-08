<script setup>
// No JS needed for this demo
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div v-for="i in 17" :key="i">
        <img :src="`/gost/No49_HorizontalGallery/1 (${i}).png`" :alt="`Image ${i}`">
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
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgb(235, 185, 239);
}

.shell {
  -webkit-mask-image: linear-gradient(to right, #0000, #000, #000, #0000);
  overflow-x: auto;
  display: flex;
  gap: 5rem;
  align-items: start;
  padding: 70px;
}

.shell > div {
  block-size: 320px;
  background-color: #fff;
  aspect-ratio: 1;
  border-radius: 10px;
  box-shadow: 0 0 5px 5px rgba(173, 173, 173, 0.3);
}

.shell img {
  height: 100%;
  width: 100%;
}

::-webkit-scrollbar {
  height: 16px;
}

::-webkit-scrollbar-track {
  background-color: #f5f5f5;
}

::-webkit-scrollbar-thumb {
  background-color: rgb(128, 215, 239);
  border-radius: 10px;
}
</style>
