<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const shellRef = ref(null)
const isDark = ref(false)

const handleWheel = (e) => {
  if (e.deltaY > 0) {
    // scroll down - dark mode
    isDark.value = true
    if (shellRef.value) {
      shellRef.value.style.backgroundColor = '#000'
      shellRef.value.style.color = '#FFF'
    }
    const box = shellRef.value?.querySelector('.box')
    if (box) box.style.background = '#FFF'
    const one = shellRef.value?.querySelector('.one')
    const two = shellRef.value?.querySelector('.two')
    if (one) {
      one.style.width = '18px'
      one.style.height = '18px'
      one.style.background = '#F5DD2B'
      one.style.border = '7px solid #000'
      const oneLine = one.querySelector('.line')
      if (oneLine) oneLine.style.opacity = '0'
      const oneSpan = one.querySelector('span')
      if (oneSpan) oneSpan.style.opacity = '0'
    }
    if (two) {
      two.style.width = '11px'
      two.style.height = '11px'
      two.style.background = '#000'
      two.style.border = '7px solid #F5DD2B'
      const twoLine = two.querySelector('.line')
      if (twoLine) twoLine.style.opacity = '1'
      const twoSpan = two.querySelector('span')
      if (twoSpan) twoSpan.style.opacity = '1'
    }
    const navLinks = shellRef.value?.querySelectorAll('nav a')
    if (navLinks) {
      navLinks.forEach(a => a.style.color = '#fff')
    }
    const ss = shellRef.value?.querySelector('nav .ss')
    if (ss) ss.style.borderBottomColor = '#fff'
    const circle = shellRef.value?.querySelector('.circle')
    if (circle) {
      circle.style.border = '19px solid #fff'
      circle.style.left = '-250px'
      circle.style.boxShadow = '0px 0px 30px 20px rgba(255, 255, 255, 0.25) inset,0px 0px 40px 30px rgba(255, 255, 255, 0.25)'
    }
    const banana = shellRef.value?.querySelector('.banana')
    if (banana) {
      banana.style.left = '610px'
      banana.style.width = '200px'
      banana.style.height = '100px'
      banana.style.top = '420px'
    }
    const mainH2 = shellRef.value?.querySelector('.main h2')
    if (mainH2) {
      mainH2.style.left = '-300px'
      mainH2.style.fontSize = '300px'
      mainH2.style.letterSpacing = '40px'
      mainH2.style.color = '#fff'
      mainH2.textContent = 'HELLO.'
    }
    const content = shellRef.value?.querySelector('.content')
    if (content) {
      content.style.opacity = '1'
      content.style.top = '160px'
    }
  } else {
    // scroll up - light mode
    isDark.value = false
    if (shellRef.value) {
      shellRef.value.style.backgroundColor = '#F5DD2B'
      shellRef.value.style.color = '#000'
    }
    const box = shellRef.value?.querySelector('.box')
    if (box) box.style.background = '#000'
    const one = shellRef.value?.querySelector('.one')
    const two = shellRef.value?.querySelector('.two')
    if (one) {
      one.style.width = '11px'
      one.style.height = '11px'
      one.style.background = '#F5DD2B'
      one.style.border = '7px solid #000'
      const oneLine = one.querySelector('.line')
      if (oneLine) oneLine.style.opacity = '1'
      const oneSpan = one.querySelector('span')
      if (oneSpan) oneSpan.style.opacity = '1'
    }
    if (two) {
      two.style.width = '18px'
      two.style.height = '18px'
      two.style.background = '#000'
      const twoLine = two.querySelector('.line')
      if (twoLine) twoLine.style.opacity = '0'
      const twoSpan = two.querySelector('span')
      if (twoSpan) twoSpan.style.opacity = '0'
    }
    const navLinks = shellRef.value?.querySelectorAll('nav a')
    if (navLinks) {
      navLinks.forEach(a => a.style.color = '#000')
    }
    const ss = shellRef.value?.querySelector('nav .ss')
    if (ss) ss.style.borderBottomColor = '#000'
    const circle = shellRef.value?.querySelector('.circle')
    if (circle) {
      circle.style.border = '19px solid #000'
      circle.style.left = '-0'
      circle.style.boxShadow = '0px 0px 30px 16px rgba(0, 0, 0, 0.25) inset,0px 0px 30px 20px rgba(0, 0, 0, 0.25)'
    }
    const banana = shellRef.value?.querySelector('.banana')
    if (banana) {
      banana.style.left = '-120px'
      banana.style.width = '780px'
      banana.style.height = '390px'
      banana.style.top = '110px'
    }
    const mainH2 = shellRef.value?.querySelector('.main h2')
    if (mainH2) {
      mainH2.style.left = '-40px'
      mainH2.style.fontSize = '220px'
      mainH2.style.letterSpacing = '0.065em'
      mainH2.style.color = '#F5DD2B'
      mainH2.textContent = 'BANANAS'
    }
    const content = shellRef.value?.querySelector('.content')
    if (content) {
      content.style.opacity = '0'
      content.style.top = '260px'
    }
  }
}

onMounted(() => {
  window.addEventListener('wheel', handleWheel)
})

onUnmounted(() => {
  window.removeEventListener('wheel', handleWheel)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell" ref="shellRef">
      <div class="title">
        <h2>A special banana</h2>
      </div>
      <div class="slide">
        <div class="top">
          <i class="iconfont icon-arrow-up">
            <div class="box"></div>
          </i>
        </div>
        <div class="bottons">
          <div class="botton one">
            <div class="line"></div>
            <span>1</span>
          </div>
          <div class="botton two">
            <div class="line"></div>
            <span>2</span>
          </div>
        </div>
        <div class="top">
          <i class="iconfont icon-arrow-down">
            <div class="box"></div>
          </i>
        </div>
      </div>
      <div class="main">
        <h2>BANANAS</h2>
        <div class="circle"></div>
        <div class="banana"></div>
      </div>
      <nav>
        <a href="">home</a>
        <a href="">home</a>
        <a href="">home</a>
        <a href="" class="ss">home</a>
      </nav>
      <div class="content">
        <h3>Banana</h3>
        <span>
          In addition to being eaten directly after ripening,
          bananas also have natural sugars that make them
          great desserts, such as cakes, ice cream, or fried or dried fruit.
        </span>
        <button>GO</button>
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
  background-color: #E8D231;
}

* {
  padding: 0;
  margin: 0;
  list-style: none;
  text-decoration: none;
}

@font-face {
  font-family: 'banana';
  src: url(/gost/No58_WebDesign/font/MedulaOne-Regular.ttf);
}

@font-face {
  font-family: 'Simonetta';
  src: url(/gost/No58_WebDesign/font/Simonetta-Black.ttf);
}

.shell {
  position: relative;
  width: 1433px;
  height: 780px;
  background: #F5DD2B;
  box-shadow: 0px 4px 116px 30px rgba(0, 0, 0, 0.25);
  border-radius: 30px;
  color: #000;
  transition: 0.2s;
}

.title h2 {
  position: absolute;
  width: 560px;
  height: 42px;
  font: 300 32px 'Simonetta';
  line-height: 40px;
  text-align: center;
  letter-spacing: 0.15em;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  line-height: 30px;
  transition: 0.3s;
}

.slide {
  position: relative;
  left: 30px;
  top: 50%;
  width: 30px;
  transform: translateY(-50%);
  height: 60%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
}

.iconfont {
  font-size: 37px;
  position: relative;
}

.box {
  content: '';
  width: 4px;
  height: 100px;
  background: #000;
  position: absolute;
  display: block;
  left: 50%;
  transform: translateX(-50%);
}

.icon-arrow-up .box {
  top: 4px;
}

.icon-arrow-down .box {
  bottom: 4px;
}

.bottons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 70px;
}

.botton {
  width: 18px;
  height: 18px;
  background: #000000;
  border-radius: 50%;
  transition: 0.3s;
  position: relative;
}

.one {
  width: 11px;
  height: 11px;
  background: #F5DD2B;
  border: 7px solid #000000;
}

.two span {
  color: #fff;
  opacity: 0;
}

.line {
  width: 40px;
  height: 3px;
  background: #000;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 25px;
  border-radius: 10px;
}

.two .line {
  background: #fff;
  opacity: 0;
}

.botton span {
  position: absolute;
  font-size: 26px;
  top: 50%;
  transform: translateY(-55%);
  left: 70px;
}

.main {
  position: relative;
  top: -50px;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 500px;
}

.main h2 {
  position: absolute;
  font: 400 220px 'banana';
  letter-spacing: 0.065em;
  z-index: 100;
  color: #F5DD2B;
  left: -40px;
  top: 150px;
  display: block;
  text-shadow: 0 5px 10px #2828286e, 0 -2px 1px #ffffff;
  transition: 0.5s;
}

.circle {
  box-sizing: border-box;
  position: absolute;
  width: 510px;
  height: 510px;
  border-radius: 50%;
  border: 19px solid #060606;
  box-shadow: 0px 0px 30px 16px rgba(0, 0, 0, 0.25) inset,
    0px 0px 30px 20px rgba(0, 0, 0, 0.25);
  transition: 0.3s;
}

.banana {
  position: absolute;
  width: 780px;
  height: 390px;
  left: -120px;
  top: 110px;
  background: url(/gost/No58_WebDesign/banana.png);
  background-size: contain;
  transition: 0.5s;
}

nav {
  width: 360px;
  display: flex;
  justify-content: space-between;
  position: absolute;
  top: 0;
  transform: rotate(-90deg);
  right: -130px;
  font-size: 24px;
  top: 370px;
  font-family: 'Simonetta';
  letter-spacing: 2px;
}

nav a {
  color: #000;
}

.ss {
  border-bottom: 5px solid rgb(0, 0, 0);
  padding-bottom: 8px;
}

.content {
  position: absolute;
  width: 440px;
  height: 130px;
  top: 260px;
  right: 150px;
  opacity: 0;
  transition: 0.5s;
}

.content h3 {
  font: 400 62px 'Simonetta';
  margin-bottom: 35px;
}

.content span {
  font: 400 24px 'Simonetta';
}

button {
  position: absolute;
  width: 124px;
  height: 46px;
  right: 0;
  top: 300px;
  border-radius: 12px;
  background: #E8D231;
  border-radius: 12px;
  border: none;
  font-size: 26px;
  letter-spacing: 3px;
}
</style>
