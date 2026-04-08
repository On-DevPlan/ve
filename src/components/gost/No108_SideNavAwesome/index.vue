<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const nav = document.querySelectorAll(".nav li")
  nav.forEach((item) => {
    item.addEventListener("click", function () {
      nav.forEach((item) => item.classList.remove("active"))
      this.classList.add("active")
    })
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <ul class="nav">
        <li class="active" id="logo">
          <a href="#">
            <div class="icon">
              <div class="imageBox">
                <img src="/gost/No108_SideNavAwesome/goat.jpg" alt="">
              </div>
            </div>
            <div class="text">山羊の前端小窝</div>
          </a>
        </li>
        <li>
          <a href="#home">
            <div class="icon">
              <i class="iconfont icon-cangku"></i>
            </div>
            <div class="text">Home</div>
          </a>
        </li>
        <li>
          <a href="#theme">
            <div class="icon">
              <i class="iconfont icon-zhuti_tiaosepan"></i>
            </div>
            <div class="text">Theme</div>
          </a>
        </li>
        <li>
          <a href="#wallet">
            <div class="icon">
              <i class="iconfont icon-qianbao"></i>
            </div>
            <div class="text">Wallet</div>
          </a>
        </li>
        <li>
          <a href="#picture">
            <div class="icon">
              <i class="iconfont icon-tupian"></i>
            </div>
            <div class="text">picture</div>
          </a>
        </li>
        <li>
          <a href="#code">
            <div class="icon">
              <i class="iconfont icon-erweima"></i>
            </div>
            <div class="text">QR code</div>
          </a>
        </li>
        <li>
          <a href="#authentication">
            <div class="icon">
              <i class="iconfont icon-dunpaibaoxianrenzheng"></i>
            </div>
            <div class="text">authentication</div>
          </a>
        </li>
        <li>
          <a href="#me">
            <div class="icon">
              <div class="imageBox">
                <img src="/gost/No108_SideNavAwesome/goat.jpg" alt="">
              </div>
            </div>
            <div class="text">ME</div>
          </a>
        </li>
      </ul>
    </div>
    <section id="">Home</section>
    <section id="theme">Theme</section>
    <section id="wallet">Wallet</section>
    <section id="picture">Picture</section>
    <section id="code">QR code</section>
    <section id="authentication">authentication</section>
    <section id="me">ME</section>
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
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  list-style: none;
  text-decoration: none;
}

section {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  font: 900 100px '';
  color: #ffa21759;
  background: #e4e9f5;
}

.shell {
  position: fixed;
  width: 84px;
  height: 100%;
  background: #000000;
  z-index: 9999;
  transition: width 0.5s;
  padding-left: 10px;
  overflow: hidden;
}

.shell:hover {
  width: 300px;
}

.imageBox {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
}

.imageBox img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shell ul {
  position: relative;
  height: 100vh;
}

.shell ul li {
  position: relative;
  padding: 5px;
}

.active {
  background: #e4e9f5;
  border-top-left-radius: 50px;
  border-bottom-left-radius: 50px;
}

.active::before {
  content: "";
  position: absolute;
  top: -30px;
  right: 0;
  width: 30px;
  height: 30px;
  border-bottom-right-radius: 25px;
  box-shadow: 5px 5px 0 5px #e4e9f5;
  background: transparent;
}

.active::after {
  content: "";
  position: absolute;
  bottom: -30px;
  right: 0;
  width: 30px;
  height: 30px;
  border-top-right-radius: 25px;
  box-shadow: 5px -5px 0 5px #e4e9f5;
  background: transparent;
}

#logo {
  margin: 40px 0 100px 0;
}

.shell ul li a {
  position: relative;
  display: flex;
  white-space: nowrap;
}

.icon {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 60px;
  padding-left: 10px;
  height: 70px;
  color: #333;
  transition: 0.5s;
  color: rgb(255, 255, 255);
}

.icon i {
  font-size: 30px;
  z-index: 999;
}

.text {
  position: relative;
  height: 70px;
  display: flex;
  align-items: center;
  font-size: 20px;
  color: #ffad32c1;
  padding-left: 15px;
  text-transform: uppercase;
  letter-spacing: 2px;
  transition: 0.5s;
}

.shell ul li:hover a .icon,
.shell ul li:hover a .text {
  color: #ffa117;
}

.active a .icon::before {
  content: "";
  position: absolute;
  inset: 5px;
  width: 60px;
  background: #000000;
  border-radius: 50%;
  transition: 0.5s;
  border: 7px solid #ffa117;
  box-sizing: border-box;
}
</style>
