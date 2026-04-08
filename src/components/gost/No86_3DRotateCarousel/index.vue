<script setup>
// Pure CSS 3D carousel - no JS needed
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="content">
        <div class="item item1"></div>
        <div class="item item2"></div>
        <div class="item item3"></div>
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
  background-image: linear-gradient(to top, #9795f0 0%, #fbc8d4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.shell {
  position: relative;
  width: 60vw;
  height: 40vw;
  max-width: 380px;
  max-height: 250px;
  margin: 0;
  color: white;
  perspective: 1000px;
  transform-origin: center;
}

.content {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  width: 100%;
  height: 100%;
  transform-origin: center;
  transform-style: preserve-3d;
  transform: translateZ(-30vw) rotateY(0);
  animation: carousel 9s infinite cubic-bezier(0.77, 0, 0.175, 1) forwards;
}

.item {
  position: absolute;
  width: 60vw;
  height: 40vw;
  max-width: 380px;
  max-height: 250px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  -webkit-box-reflect: below 25px -webkit-linear-gradient(transparent 50%, rgba(255, 255, 255, 0.3));
}

.item1 {
  background-image: url(/gost/No86_3DRotateCarousel/01.jpg);
  transform: rotateY(0) translateZ(35vw);
}

.item2 {
  background-image: url(/gost/No86_3DRotateCarousel/02.jpg);
  transform: rotateY(120deg) translateZ(35vw);
}

.item3 {
  background-image: url(/gost/No86_3DRotateCarousel/03.jpg);
  transform: rotateY(240deg) translateZ(35vw);
}

@keyframes carousel {
  0%, 17.5% {
    transform: translateZ(-35vw) rotateY(0);
  }
  27.5%, 45% {
    transform: translateZ(-35vw) rotateY(-120deg);
  }
  55%, 72.5% {
    transform: translateZ(-35vw) rotateY(-240deg);
  }
  82.5%, 100% {
    transform: translateZ(-35vw) rotateY(-360deg);
  }
}
</style>
