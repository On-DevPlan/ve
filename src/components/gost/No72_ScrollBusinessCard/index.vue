<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const index = ref(0)
const mainRef = ref(null)

function add() {
  if (index.value < 1) {
    index.value = 2
  } else {
    index.value--
  }
}

function desc() {
  if (index.value > 1) {
    index.value = 0
  } else {
    index.value++
  }
}

function position() {
  if (mainRef.value) {
    mainRef.value.style.left = (index.value * -100) + '%'
  }
}

function handleLeftClick() {
  add()
  position()
}

function handleRightClick() {
  desc()
  position()
}

onMounted(() => {
  position()
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="ocean">
        <div class="ocean-text">GOAT</div>
      </div>
      <div class="content">
        <div class="left" @click="handleLeftClick"></div>
        <div class="right" @click="handleRightClick"></div>
        <div class="main" ref="mainRef">
          <div class="box">
            <div class="page">
              <h2> 01</h2>
              <span> / 03</span>
            </div>
            <div class="title">
              <h4> More than</h4>
              <h1> 1 000 000</h1>
              <h5> seabirds die yearly due to plastic debris</h5>
            </div>
            <div class="article">
              <h2> Facts and Stats on Ocean Pollution</h2>
              <p> Lorem ipsum dolor, sit amet consectetur adipisicing elit. Inventore, amet hic provident ipsa
                placeat ad. Excepturi distinctio consectetur voluptatibus rem deleniti ducimus officia
                natus, magnam aut architecto sint reprehenderit provident?</p>
            </div>
          </div>

          <div class="box">
            <div class="page">
              <h2> 02</h2>
              <span> / 03</span>
            </div>
            <div class="title">
              <h4> More than</h4>
              <h1> 1 000 000</h1>
              <h5> seabirds die yearly due to plastic debris</h5>
            </div>
            <div class="article">
              <h2> Facts and Stats on Ocean Pollution</h2>
              <p> Lorem ipsum dolor, sit amet consectetur adipisicing elit. Inventore, amet hic provident ipsa
                placeat ad. Excepturi distinctio consectetur voluptatibus rem deleniti ducimus officia
                natus, magnam aut architecto sint reprehenderit provident?</p>
            </div>
          </div>

          <div class="box">
            <div class="page">
              <h2> 03</h2>
              <span> / 03</span>
            </div>
            <div class="title">
              <h4> More than</h4>
              <h1> 1 000 000</h1>
              <h5> seabirds die yearly due to plastic debris</h5>
            </div>
            <div class="article">
              <h2> Facts and Stats on Ocean Pollution</h2>
              <p> Lorem ipsum dolor, sit amet consectetur adipisicing elit. Inventore, amet hic provident ipsa
                placeat ad. Excepturi distinctio consectetur voluptatibus rem deleniti ducimus officia
                natus, magnam aut architecto sint reprehenderit provident?</p>
            </div>
          </div>
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
}

.shell {
  display: flex;
  flex-direction: column;
  width: 90vw;
  height: 90vh;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);
  background-color: #fff;
  color: #000;
  overflow: hidden;
  margin: 5vh auto;
}

.ocean {
  width: 100%;
  height: 60%;
  background-color: blue;
  background-image: url(/gost/No72_ScrollBusinessCard/images/bg.jpg);
  background-repeat: no-repeat;
  background-size: cover;
  overflow: hidden;
  position: relative;
}

.ocean-text {
  font: 900 45vh '';
  position: relative;
  background-image: url(/gost/No72_ScrollBusinessCard/images/text.jpg);
  background-size: 160% auto;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  transform: translate(25%, -5%);
  -webkit-text-stroke: 5px #ffffff;
}

.content {
  position: relative;
  width: 100%;
  height: 40%;
  display: flex;
  justify-content: space-between;
}

.main {
  width: 300%;
  height: 35vh;
  position: relative;
  display: flex;
  left: 0;
  transition: .3s;
}

.box {
  width: 100vw;
  height: 100%;
  position: relative;
}

.page {
  position: absolute;
  color: #fff;
  left: 150px;
  top: -80px;
}

.page h2 {
  font: 900 120px '';
  color: #29519b;
}

.page span {
  font: 400 30px '';
  position: absolute;
  right: -55px;
  top: 30px;
  color: rgb(134, 194, 250);
}

.bbspan {
  display: block;
  font: 500 40px '';
  position: absolute;
  top: 50%;
  transform: translateY(-55%);
  left: 150px;
}

.box h3 {
  position: absolute;
  right: 180px;
  top: 50%;
  font: 100 19px '';
  transform: translateY(-50%);
}

.left {
  width: 40px;
  height: 40px;
  background-image: url("/gost/No72_ScrollBusinessCard/images/left.png");
  background-size: cover;
  position: absolute;
  top: 50%;
  left: 2%;
  transform: translateY(-50%);
  z-index: 999;
  opacity: 0.5;
  cursor: pointer;
}

.right {
  width: 40px;
  height: 40px;
  background-image: url("/gost/No72_ScrollBusinessCard/images/right.png");
  background-size: cover;
  position: absolute;
  top: 50%;
  right: 2%;
  transform: translateY(-50%);
  z-index: 999;
  cursor: pointer;
}

.title {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 120px;
}

h1 {
  color: #29519b;
}

.article {
  width: 40%;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: 120px;
}

.article h2 {
  margin-bottom: 10px;
  font-size: 30px;
  color: #29519b;
}
</style>
