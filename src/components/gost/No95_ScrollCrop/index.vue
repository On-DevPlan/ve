<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const headerRef = ref(null)
const imgRef = ref(null)
let scrollDistance = 0
let requestId = null

onMounted(() => {
  const updateHeaderClipPath = () => {
    const clipPathValue = `polygon(0 0, 100% 0%, 100% ${(scrollDistance <= 600) ? 100 - ((scrollDistance / 600) * 60) : 75}%, 0 100%)`
    if (headerRef.value) {
      headerRef.value.style.clipPath = clipPathValue
    }
    const scaleValue = 1 + ((scrollDistance / 600) * 1)
    if (imgRef.value) {
      imgRef.value.style.transform = `scale(${scaleValue})`
    }
  }

  const scrollHandler = (event) => {
    if (event.deltaY < 0) {
      scrollDistance = Math.max(0, scrollDistance + event.deltaY)
    } else {
      scrollDistance = Math.min(600, scrollDistance + event.deltaY)
    }
    if (!requestId) {
      requestId = window.requestAnimationFrame(() => {
        updateHeaderClipPath()
        requestId = null
      })
    }
  }

  window.addEventListener('wheel', scrollHandler)

  return () => {
    window.removeEventListener('wheel', scrollHandler)
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <header ref="headerRef">
        <div class="img" ref="imgRef"></div>
      </header>
      <div class="main">
        <main>
          <article>
            <div class="multicol">
              <h1>this is the</h1>
              <h2> の front nest of the goat</h2>
              <p>
                This piece of code is a simple static webpage design that showcases a page called "山羊の前端小窝"
                (Goat's Frontend Nest). In this 800-word summary, I will provide an overview of the code.
              </p>
            </div>
            <img src="/gost/No95_ScrollCrop/3.jpg" alt="">
            <div class="multicol">
              <p>
                Within the head tag, the meta tag is used to set the character set and viewport size.
                The title tag sets the webpage title as "山羊の前端小窝" (Goat's Frontend Nest).
              </p>
            </div>
            <img src="/gost/No95_ScrollCrop/2.jpg" alt="">
            <div class="multicol">
              <p>
                The code showcases a simple static webpage design. By combining HTML, CSS,
                and JavaScript, it achieves the layout of page elements and scroll interaction effects.
              </p>
            </div>
          </article>
        </main>
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
}

* {
  padding: 0;
  margin: 0;
}

.shell {
  width: 100%;
  display: flex;
  flex-direction: column;
}

header {
  width: 100%;
  height: 700px;
  overflow: hidden;
  clip-path: polygon(0 0, 100% 0%, 100% 100%, 0 100%);
  transition: clip-path 0.5s ease;
  position: relative;
}

.img {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: url(/gost/No95_ScrollCrop/1.jpg);
  background-size: cover;
  transform: scale(1);
  transition: transform 0.5s ease;
}

.main {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  flex-direction: column;
  margin-top: 100px;
}

.main h2 {
  font-size: 50px;
  margin-bottom: 40px;
}

.main span {
  padding: 0 100px;
  font-size: 30px;
}

@import url('https://fonts.googleapis.com/css?family=Lato:700,900');

@font-face {
  font-family: Arno Pro;
  src: url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/4273/ArnoPro-Regular.otf);
  font-style: normal;
}

p {
  font-family: Arno Pro, serif;
  font-size: 1.4rem;
  line-height: 1.4;
  margin: 0;
}

.multicol {
  column-count: 4;
  column-gap: 2rem;
}

article {
  width: 80%;
  margin: 0 auto 4rem;
}

article img {
  width: 100%;
}

article header {
  margin-bottom: 2.5rem;
  padding-bottom: 4rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.8);
}

article h1 {
  margin-top: 0;
  font-size: 3rem;
}

h1, h2 {
  font-family: Lato, sans-serif;
}
</style>
