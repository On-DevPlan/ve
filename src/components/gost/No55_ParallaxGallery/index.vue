<script setup>
// Pure CSS parallax gallery - no JavaScript needed
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="images slower">
        <img src="/gost/No55_ParallaxGallery/1.png">
      </div>
      <div class="images faster">
        <img src="/gost/No55_ParallaxGallery/2.png">
      </div>
      <div class="images vertical">
        <img src="/gost/No55_ParallaxGallery/3.png">
      </div>
      <div class="images slower-down">
        <img src="/gost/No55_ParallaxGallery/4.png">
      </div>
      <div class="images">
        <img src="/gost/No55_ParallaxGallery/5.png">
      </div>
      <div class="images slower">
        <img src="/gost/No55_ParallaxGallery/6.png">
      </div>
      <div class="images faster1">
        <img src="/gost/No55_ParallaxGallery/7.png">
      </div>
      <div class="images slower1">
        <img src="/gost/No55_ParallaxGallery/8.png">
      </div>
      <div class="images">
        <img src="/gost/No55_ParallaxGallery/9.png">
      </div>
      <div class="images slower">
        <img src="/gost/No55_ParallaxGallery/10.png">
      </div>
      <div class="images faster">
        <img src="/gost/No55_ParallaxGallery/11.png">
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-image: linear-gradient(-225deg, #FFE29F 0%, #FFA99F 48%, #FF719A 100%);
}

::-webkit-scrollbar {
  width: 1px;
  height: 1px;
}

.images img {
  border: #fff solid 10px;
  max-width: 45vh;
  max-height: 50vh;
  transition: 0.5s;
}

.images:hover img {
  box-shadow: 0 10px 30px #86c4f7;
  transform: scale(1.05);
}

.shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100vh;
  transform: rotate(-90deg) translate3d(0, -100vh, 0);
  transform-origin: right top;
  overflow-x: hidden;
  height: 100vw;
  perspective: 1px;
  transform-style: preserve-3d;
}

.images {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  transform-origin: 50% 50%;
  transform: rotate(90deg) translateZ(0.1px) scale(1.1) translateX(0px) translateY(2vh);
  transition: 1s;
}

.slower {
  transform: rotate(90deg) translateZ(-0.12px) scale(1.3) translateX(0%) translateY(-8vh);
}

.slower1 {
  transform: rotate(90deg) translateZ(-0.25px) scale(1.35) translateX(0%) translateY(2vh);
}

.slower-down {
  transform: rotate(90deg) translateZ(-0.1px) scale(1) translateX(0%) translateY(16vh);
}

.faster {
  transform: rotate(90deg) translateZ(-0.05px) scale(1.1) translateX(0%) translateY(15vh);
}

.faster1 {
  transform: rotate(90deg) translateZ(0.05px) scale(1.4) translateX(0%) translateY(10vh);
}

.fastest {
  transform: rotate(90deg) translateZ(0.22px) scale(0.7) translateX(-10vh) translateY(-15vh);
}

.vertical {
  transform: rotate(90deg) translateZ(-0.1px) scale(1.6) translateX(0%) translateY(-3vh);
}
</style>
