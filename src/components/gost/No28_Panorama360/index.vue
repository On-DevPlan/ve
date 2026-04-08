<script setup>
import { ref, onMounted } from 'vue'

const imgRef = ref(null)

onMounted(() => {
  const img = imgRef.value
  if (!img) return

  img.addEventListener('mouseenter', function(e) {
    this.x = e.clientX
    this.y = e.clientY
  })

  img.addEventListener('mousemove', function(e) {
    this._x = e.clientX
    this._y = e.clientY
    const disx = this._x - this.x
    const disy = this._y - this.y
    const movex = disx * 2
    const movey = -600 + disy / 1.6
    img.style.backgroundPosition = `${movex}px ${movey}px`
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="img" ref="imgRef"></div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
}
.shell {
  width: 100%;
  height: 100vh;
}
.img {
  width: 100%;
  height: 100%;
  background-image: url('/gost/No28_Panorama360/img.jpg');
  background-repeat: repeat-x;
  background-position: 0 -600px;
}
</style>
