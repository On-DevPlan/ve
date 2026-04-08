<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="box wave"></div>
      <div class="box wave"></div>
      <div class="box wave"></div>
      <div class="text-wrapper">
        <div class="text-content">
          <span class="wave">Think big,</span>
          <br>
          <span class="wave">TAct small.</span>
        </div>
        <div class="text-author">
          <span class="wave">- BILIBILI</span>
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
  position: relative;
  display: flex;
  font-family: "Yeseva One";
}

@import url("https://fonts.googleapis.com/css2?family=Yeseva+One&display=swap");

* {
  box-sizing: border-box;
  margin: auto;
}

video {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}

.shell {
  position: relative;
  max-width: 100vh;
  aspect-ratio: 1/1;
  display: flex;
  border-radius: 50%;
  overflow: hidden;
  text-align: center;
  filter: drop-shadow(-30px 30px 10px #006e9d);
}

.text-wrapper {
  font-size: 110px;
}

span.wave {
  background: -50% 0%/200% 100% linear-gradient(90deg, #32967048, #0a26ff, #32967048);
  color: transparent;
  background-clip: text;
  animation: flow 4s linear infinite;
  padding: 0 70px;
}

.text-author {
  font-size: 80px;
  text-align: right;
}

.box {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #fff;
}

.box:nth-of-type(1) {
  height: 35%;
  opacity: 0.6;
}

.box:nth-of-type(2) {
  height: 67%;
  opacity: 0.5;
}

.box:nth-of-type(3) {
  height: 93%;
  opacity: 0.4;
}

.wave {
  -webkit-mask: radial-gradient(46.6px at 50% calc(100% - (27px + 38px)),
      #fff 99%, #ffffff00 101%), radial-gradient(46.6px at 50% calc(100% + 38px),
      #ffffff00 99%, #fff 101%) repeat-x;
  -webkit-mask-size: calc(4*27px) 100%;
  -webkit-mask-position: calc(50% - 2*27px) 0, 50% calc(100% - 27px);
  animation: flow 5s linear infinite;
}

@keyframes flow {
  100% {
    -webkit-mask-position: calc(50% - 6*27px) 0, calc(50% - 4*27px) calc(200% - 27px);
  }
}
</style>
