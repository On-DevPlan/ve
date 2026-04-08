<script setup>
import { ref } from 'vue'

const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="photo">
        <img src="/gost/No83_RotatingCard/1.jpg" alt="" />
      </div>
      <div class="content">
        <div class="text">
          <h3>Business card</h3>
          <h6>BILIBILI-山羊の前端小窝</h6>
        </div>
        <div class="btn" :class="{ active: isOpen }" @click="toggle">
          <span></span>
        </div>
      </div>
      <div class="box" :class="{ open: isOpen }">
        <div class="icon-item">Q</div>
        <div class="icon-item">▶</div>
        <div class="icon-item">微</div>
        <div class="icon-item">豆</div>
        <div class="icon-item">B</div>
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
  background-color: #f3f3f3;
}

* {
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.shell {
  width: 330px;
  height: 100px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 5px;
  background-color: #fafafa;
  box-shadow: 0 0 2rem #babbbc;
  animation: show-shell 0.5s forwards ease-in-out;
}

@keyframes show-shell {
  0% { width: 0; }
}

.photo,
.content {
  box-sizing: border-box;
}

.photo {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  border: 5px solid #fafafa;
  background-color: #fafafa;
  margin-left: -50px;
  box-shadow: 0 0 0.5rem #babbbc;
  animation: rotate-photo 0.5s forwards ease-in-out;
  float: left;
}

@keyframes rotate-photo {
  100% { transform: rotate(-360deg); }
}

.photo img {
  width: 100%;
}

.content {
  padding: 10px;
  overflow: hidden;
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.content::before {
  content: "";
  position: absolute;
  width: 230px;
  height: 150px;
  left: 0;
  top: -20px;
  z-index: -1;
  transform: rotate(-8deg);
  background-image: linear-gradient(to top, #6866ee 0%, #fbc8d4 100%);
}

.content .text {
  margin-top: 20px;
  margin-left: 50px;
}

.content .text h3,
.content .text h6 {
  font-weight: normal;
  margin: 3px 0;
  letter-spacing: 0.5px;
  white-space: nowrap;
  color: #ffffff;
}

.content .btn {
  background-color: rgb(106, 106, 245);
  width: 50px;
  height: 50px;
  position: absolute;
  right: 25px;
  top: 25px;
  border-radius: 50%;
  z-index: 1;
  cursor: pointer;
  transition-duration: 0.3s;
  animation: pop-btn 0.3s both ease-in-out 0.5s;
}

@keyframes pop-btn {
  0% { transform: scale(0); }
  80% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.content .btn:hover {
  box-shadow: 0 0 0 5px rgba(170, 187, 204, 0.5);
}

.content .btn span {
  width: 60%;
  height: 2px;
  position: absolute;
  background-color: white;
  top: 50%;
  left: 20%;
  transform: translateY(-50%);
  animation: to-hamburger 0.3s forwards ease-in-out 0.5s;
}

.content .btn span::before,
.content .btn span::after {
  content: "";
  width: 100%;
  height: 2px;
  position: absolute;
  background-color: white;
  transition-duration: 0.3s;
  transform: rotate(0deg);
  right: 0;
}

.content .btn span::before {
  margin-top: -7px;
}

.content .btn span::after {
  margin-top: 7px;
}

.content .btn.active span {
  animation: to-arrow 0.3s forwards ease-in-out;
}

.content .btn.active span::before,
.content .btn.active span::after {
  width: 60%;
  right: -1px;
}

.content .btn.active span::before {
  transform: rotate(45deg);
}

.content .btn.active span::after {
  transform: rotate(-45deg);
}

@keyframes to-hamburger {
  from { transform: translateY(-50%) rotate(-180deg); }
}

@keyframes to-arrow {
  from { transform: translateY(-50%) rotate(0deg); }
  to { transform: translateY(-50%) rotate(180deg); }
}

.box {
  opacity: 0;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.7);
  position: absolute;
  top: 50%;
  right: -30%;
  transform: translate(-50%, -50%);
  transition-duration: 0.3s;
  box-shadow: 0 0 10px #fff;
  border: 5px #fff solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px;
  width: 120px;
  height: 120px;
}

.box::after {
  content: '';
  display: block;
  width: 120px;
  height: 120px;
  background-image: url(/gost/No83_RotatingCard/2.gif);
  background-size: cover;
  opacity: 0.7;
  border-radius: 50%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
}

.box.open {
  opacity: 1;
}

.icon-item {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #fff;
  font-size: 26px;
  text-align: center;
  line-height: 60px;
  box-shadow: 0 0 10px #fff;
  color: rgb(106, 106, 245);
  transition-duration: 0.3s;
  cursor: pointer;
  position: absolute;
  left: 18px;
  top: calc(60px - 50px / 2);
  opacity: 0;
}

.icon-item:hover {
  transition-delay: initial !important;
  box-shadow: 0 0 0 5px #babbbc;
  background-color: rgb(106, 106, 245);
  color: #fff;
}

.box.open .icon-item {
  opacity: 1;
}

.box.open .icon-item:nth-of-type(1) {
  transform: rotate(-90deg) translateX(120px) rotate(90deg);
  transition-delay: 0s;
}

.box.open .icon-item:nth-of-type(2) {
  transform: rotate(-45deg) translateX(120px) rotate(45deg);
  transition-delay: 0.1s;
}

.box.open .icon-item:nth-of-type(3) {
  transform: rotate(0deg) translateX(130px) rotate(0deg);
  transition-delay: 0.2s;
}

.box.open .icon-item:nth-of-type(4) {
  transform: rotate(45deg) translateX(120px) rotate(-45deg);
  transition-delay: 0.3s;
}

.box.open .icon-item:nth-of-type(5) {
  transform: rotate(90deg) translateX(110px) rotate(-90deg);
  transition-delay: 0.4s;
}
</style>
