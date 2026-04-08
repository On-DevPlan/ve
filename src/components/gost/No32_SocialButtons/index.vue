<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="box">
        <span class="iconfont">&#xe673;</span>
        <div class="tooltip">Wx：Sad-of-goat</div>
      </div>
      <div class="box">
        <span class="iconfont">&#xe630;</span>
        <div class="tooltip">qq群：437458225</div>
      </div>
      <div class="box">
        <span class="iconfont">&#xe614;</span>
        <div class="tooltip">bilibili：山羊の前端小窝</div>
      </div>
      <div class="box">
        <span class="iconfont">&#xe601;</span>
        <div class="tooltip">淘宝店铺：tb74416564</div>
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
  background-color: #81b29a;
  display: flex;
  justify-content: center;
  align-items: center;
}
.shell {
  width: 550px;
  height: 100px;
  border: solid 2px #000;
  display: flex;
  justify-content: space-evenly;
  position: relative;
}
.box {
  width: 25%;
  height: 100%;
  text-align: center;
  position: relative;
}
.iconfont {
  display: block;
  color: #3d405b;
  font-size: 50px;
  line-height: 100px;
  transition: .2s;
  font-family: 'iconfont';
}
.iconfont:hover {
  color: #f4f1de;
}
.shell::after {
  content: 'Contact me';
  font-size: 21px;
  position: absolute;
  right: 0;
  top: -35px;
  color: #f4f1de;
}
.shell::before {
  content: '';
  position: absolute;
  top: -21px;
  left: 0;
  display: block;
  width: 77%;
  height: 3px;
  background-color: #f4f1de;
}
.tooltip {
  position: absolute;
  bottom: 140px;
  width: 100%;
  left: 0;
  font-size: 30px;
  color: #81b29a;
  background-color: #f4f1de;
  opacity: 0;
  transform: translateY(30px);
  transition: .3s .2s;
  z-index: -99;
  white-space: nowrap;
}
.iconfont:hover + .tooltip {
  opacity: 1;
  transform: translateY(0);
}
</style>
