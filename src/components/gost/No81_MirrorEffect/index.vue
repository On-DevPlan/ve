<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const wrapperRef = ref(null)
let $body = null
let $heroA = null
let $heroB = null
let $heroC = null
let mouseMoveHandler = null

onMounted(async () => {
  // Wait for jQuery and TweenMax to load
  const waitForJQuery = () => {
    return new Promise((resolve) => {
      if (window.$ && window.TweenMax) {
        resolve()
      } else {
        setTimeout(waitForJQuery, 50)
      }
    })
  }

  await waitForJQuery()

  $body = window.$('body')
  $heroA = window.$('#box-a img')
  $heroB = window.$('#box-b img')
  $heroC = window.$('#box-c img')

  window.TweenMax.set($heroA, { transformStyle: 'preserve-3d' })
  window.TweenMax.set($heroB, { transformStyle: 'preserve-3d' })
  window.TweenMax.set($heroC, { transformStyle: 'preserve-3d' })

  mouseMoveHandler = function (e) {
    const bodyWidth = $body.width()
    const bodyHeight = $body.height()
    const sxPos = e.pageX / bodyWidth * 300 - 50
    const syPos = e.pageY / bodyHeight * 300 - 50

    window.TweenMax.to($heroA, 1, {
      rotationY: 0.05 * sxPos, rotationX: 0.20 * syPos,
      rotationZ: '-0.1', transformPerspective: 500,
    })
    window.TweenMax.to($heroB, 1, {
      rotationY: 0.10 * sxPos,
      rotationX: 0.15 * syPos, rotationZ: 0, transformPerspective: 500,
    })
    window.TweenMax.to($heroC, 1, {
      rotationY: 0.15 * sxPos,
      rotationX: 0.10 * syPos, rotationZ: 0.10, transformPerspective: 500,
    })
  }

  $body.on('mousemove', mouseMoveHandler)
})

onUnmounted(() => {
  if ($body && mouseMoveHandler) {
    $body.off('mousemove', mouseMoveHandler)
  }
})
</script>

<template>
  <div class="demo-wrapper" ref="wrapperRef">
    <div class="shell">
      <div class="box" id="box-a">
        <img src="/gost/No81_MirrorEffect/1.jpg" alt="">
      </div>
      <div class="box" id="box-b">
        <img src="/gost/No81_MirrorEffect/1.jpg" alt="">
      </div>
      <div class="box" id="box-c">
        <img src="/gost/No81_MirrorEffect/1.jpg" alt="">
      </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/1.18.5/TweenMax.min.js"></script>
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
  background: radial-gradient(circle farthest-side at center bottom,
    crimson, #003087 130%);
}

.shell {
  height: 260px;
  width: 500px;
}

.box {
  filter: grayscale(40%);
}

.box img {
  position: absolute;
  opacity: 0.4;
  margin: auto;
  width: 100%;
}
</style>
