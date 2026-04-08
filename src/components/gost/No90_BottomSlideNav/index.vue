<script setup>
import { ref, onMounted } from 'vue'

const activeIndex = ref(0)

onMounted(() => {
  const navigationTabItems = document.querySelectorAll(".nav-item")
  navigationTabItems.forEach(function (item, index) {
    item.addEventListener("click", function () {
      navigationTabItems.forEach(function (item) {
        item.classList.remove("active")
      })
      this.classList.add("active")
      activeIndex.value = index
      document.querySelector(".nav-overlay").style.left = index * 170 + "px"
    })
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <nav class="nav">
      <div class="nav-item active">
        <span class="nav__icon">
          <i class="iconfont icon-zhuye"></i>
        </span>
        <span class="text">Home</span>
      </div>
      <div class="nav-item">
        <span class="nav__icon">
          <i class="iconfont icon-dongtai"></i>
        </span>
        <span class="text">Relation</span>
      </div>
      <div class="nav-item">
        <span class="nav__icon">
          <i class="iconfont icon-xiaoxizhongxin"></i>
        </span>
        <span class="text">News</span>
      </div>
      <div class="nav-item">
        <span class="nav__icon">
          <i class="iconfont icon-wode"></i>
        </span>
        <span class="text">Me</span>
      </div>
      <div class="nav-overlay"></div>
    </nav>
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
  background-color: #7dbfff;
}

* {
  padding: 0;
  margin: 0;
}

.nav {
  height: 150px;
  width: 800px;
  background-color: #fff;
  box-shadow: 0 50px 30px 0 rgba(0, 0, 0, 0.2);
  border-radius: 20px 20px 90px 90px;
  overflow: hidden;
  border: 15px solid #fff;
  display: flex;
  position: relative;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 170px;
  flex-shrink: 0;
  cursor: pointer;
  transition: 0.3s;
  position: relative;
  z-index: 2;
}

.nav-item.active {
  width: 290px;
}

.nav-item.active .nav__icon {
  transform: translateY(-15px);
}

.nav-item.active .text {
  opacity: 1;
  transform: translateY(10px);
}

.nav-overlay {
  border-radius: 20px;
  background-color: #e4f2ff;
  height: 100%;
  width: 290px;
  position: absolute;
  left: 0;
  top: 0;
  transition: 0.3s;
}

.nav__icon {
  transition: .3s;
}

.iconfont {
  display: block;
  color: #4298e7;
  font-size: 50px;
  transition: 0.3s;
  line-height: 1;
  transform: translateY(11px);
}

.text {
  display: block;
  font-weight: 400;
  font-size: 30px;
  color: #4298e7;
  opacity: 0;
  transition-duration: 0.3s;
  transform: translateY(20px);
  user-select: none;
}
</style>
