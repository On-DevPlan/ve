<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  document.querySelectorAll('.box').forEach(function (wrapper) {
    wrapper.addEventListener('mousemove', function (e) {
      const rect = wrapper.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      const img = wrapper.querySelector('img')
      img.style.transform = `rotate(0deg) translate3d(${x * -0.5}px, ${y * -0.5}px, 0) scale(1.6)`
    })

    wrapper.addEventListener('mouseleave', function () {
      const img = wrapper.querySelector('img')
      img.style.transform = 'rotate(-45deg) scale(1.5)'
    })
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <article class="shell">
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/01.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/02.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/03.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/04.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/05.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/06.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/07.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/08.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/09.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/10.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/11.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/12.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/13.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/14.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/15.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/16.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/17.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/18.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/19.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/20.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/21.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/22.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/23.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/24.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/25.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/26.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/27.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/28.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/29.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/33.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/30.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/31.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/34.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/35.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/36.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/37.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/38.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/39.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/40.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/41.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/42.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/43.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/44.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/45.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/46.jpg" /></div>
      <div class="box"><img src="/gost/No109_DiamondAlbum/image/47.jpg" /></div>
    </article>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  margin: 0;
  display: grid;
  place-items: center;
  background-image: linear-gradient(to bottom left, #b4e9ff, #bdb6ec, #d7b3e3, #ffc1d1);
}

* {
  padding: 0;
  margin: 0;
}

.shell {
  --size: 100px;
  display: grid;
  grid-template-columns: repeat(14, var(--size));
  grid-auto-rows: var(--size);
  place-items: start center;
  gap: 10px;
  margin-bottom: 50px;
}

.shell img {
  object-fit: cover;
  width: 100%;
  height: 100%;
  transform: rotate(-45deg) scale(1.5);
  transition: .05s;
}

.box {
  width: 130px;
  height: 130px;
  position: relative;
  overflow: hidden;
  transform: rotate(45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  grid-column: auto / span 2;
  border-radius: 10px;
  box-shadow: 5px 0 5px #00000027;
  border: 5px solid #fff;
  cursor: pointer;
  transition: .3s;
}

.box:nth-child(13n - 5) {
  grid-column: 2 / span 2;
}

.shell:hover img:not(:hover) {
  filter: brightness(0.8) contrast(0.7);
}

.box:hover {
  transform: rotate(0) scale(1.7);
  z-index: 1;
}
</style>
