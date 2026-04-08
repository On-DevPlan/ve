<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const emojiRef = ref(null)
let parallaxInstance = null

onMounted(async () => {
  // Load Parallax.js from CDN
  if (!window.Parallax) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/parallax/2.1.3/parallax.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  if (emojiRef.value) {
    const options = {
      invertX: false,
      invertY: false,
      limitX: 40,
      limitY: 40
    }
    parallaxInstance = new window.Parallax(emojiRef.value, options)
  }
})

onUnmounted(() => {
  if (parallaxInstance) {
    parallaxInstance = null
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <ul id="emoji" ref="emojiRef">
      <li class="layer" data-depth="0.2">
        <div class="face"></div>
      </li>
      <li class="layer" data-depth="0.3">
        <div class="shine"></div>
      </li>
      <li class="layer" data-depth="0.8">
        <div class="eye left"></div>
      </li>
      <li class="layer" data-depth="0.8">
        <div class="eye right"></div>
      </li>
      <li class="layer" data-depth="0.8">
        <div class="mouth"></div>
      </li>
    </ul>
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
  background-color: #9197f1;
}

* {
  padding: 0;
  margin: 0;
  list-style: none;
}

:global(#emoji) {
  position: relative;
  width: 450px;
  height: 400px;
  transform: translate3d(0, 0, 0);
}

.layer {
  position: absolute;
  width: 100%;
  height: 100%;
}

.face {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  width: 230px;
  height: 230px;
  background-color: #FECA32;
  border-radius: 100%;
  box-shadow: inset rgba(0, 0, 0, 0.4) 0 0 30px;
  transition: 0.3s;
}

.shine {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  width: 194px;
  height: 206px;
  background: linear-gradient(to bottom, #FFFFFF,
      rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0));
  border-radius: 100%;
  opacity: 0.8;
}

.eye {
  width: 24px;
  height: 38px;
  background-color: #A1620F;
  border-radius: 100%;
  box-shadow: inset rgba(0, 0, 0, 0.5) 0 6px 12px,
    rgba(255, 255, 255, 0.2) 0 2px 0 2px;
  transition: 0.3s;
}

.eye.left {
  position: absolute;
  top: 0;
  right: 70px;
  bottom: 40px;
  left: 0;
  margin: auto;
}

.eye.right {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 40px;
  left: 70px;
  margin: auto;
}

.left::before {
  content: "";
  position: absolute;
  z-index: 3;
  width: 100px;
  height: 85px;
  border-radius: 50%;
  background: radial-gradient(circle at 0 0, transparent 80%,
      #78280880%, #78280890%, transparent 90%);
  bottom: 80px;
  right: 0px;
  transform: rotatez(25deg);
  opacity: 0;
}

.right::before {
  content: "";
  position: absolute;
  z-index: 3;
  width: 100px;
  height: 85px;
  border-radius: 50%;
  background: radial-gradient(circle at 100% 0, transparent 80%,
      #78280880%, #78280890%, transparent 90%);
  bottom: 80px;
  left: 0px;
  transform: rotatez(-25deg);
  opacity: 0;
}

.mouth {
  position: absolute;
  top: 88px;
  right: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  overflow: hidden;
  width: 94px;
  height: 48px;
  transition: 0.3s;
}

.mouth:before {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 10px;
  left: 0;
  margin: auto;
  content: "";
  width: 100%;
  height: 100%;
  background-color: #6E440B;
  border-radius: 100%;
  box-shadow: rgba(255, 255, 255, 0.25) 0 3px 0;
  transform: scale(1);
}

.mouth:after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 26px;
  left: 0;
  margin: auto;
  content: "";
  width: calc(100% - 20px);
  height: 100%;
  background-color: #FECA32;
  border-radius: 100%;
  box-shadow: rgba(0, 0, 0, 0.8) 0 4px 4px -4px;
  transform-origin: 50% 100%;
  transform: scale(1.6);
}

/* hover */
#emoji:hover .face {
  background-color: rgb(230, 80, 7);
}

#emoji:hover .eye {
  height: 30px;
  box-shadow: inset rgba(0, 0, 0, 0.5) 0 6px 12px,
    rgba(250, 160, 55, 0.3) 0 2px 0 2px;
}

#emoji:hover .left,
#emoji:hover .right {
  top: 45px;
  bottom: 40px;
}

#emoji:hover .left::before,
#emoji:hover .right::before {
  opacity: 1;
  bottom: 40px;
  transition: 0.3s;
}

#emoji:hover .mouth {
  overflow: visible;
  top: 120px;
  width: 84px;
  height: 35px;
  transform: translate3d(0, 0, 0);
  background: #782808;
  border-radius: 60%/80%;
  box-shadow: inset 0 0 10px 1px black;
}

#emoji:hover .mouth:before {
  opacity: 0;
}

#emoji:hover .mouth:after {
  transform: scale(1);
  width: 68px;
  height: 75px;
  background: linear-gradient(90deg, transparent 45%, #78280850%, transparent 55%),
    radial-gradient(circle at 50% 10%, rgb(240, 40, 115), #fb88c8 55%);
  background-repeat: no-repeat;
  background-size: 100% 50%,
    100% 100%;
  top: 15px;
  bottom: auto;
  left: 50%;
  margin: auto -34px;
  border-radius: 7px 7px 50% 50%/10% 10% 50% 50%;
  filter: blur(2px);
  box-shadow: inset 0 -2px 3px 0 mediumvioletred,
    inset 0 -5px 10px 7px rgb(240, 40, 115), 0 5px 10px 1px black;
}
</style>
