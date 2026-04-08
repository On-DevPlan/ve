<template>
  <div class="demo-wrapper">
    <div class="a">
      <a href="#">阿巴</a>
      <a href="#">阿巴</a>
      <a href="#">阿巴</a>
      <a href="#">阿巴</a>
      <a href="#">阿巴</a>
      <div class="b"></div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: rgb(60,60,70);
  display: flex;
  justify-content: center;
}
.a {
  position: relative;
  top: 250px;
  display: flex;
  box-shadow: 2px 5px 15px rgb(0,0,0,.7);
  border-radius: 10px;
}
.a a {
  width: 150px;
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 30px;
  text-decoration: none;
  color: seashell;
}
.b {
  position: absolute;
  left: 0;
  width: 150px;
  height: 60px;
  border-radius: 10px;
  background-color: rgb(100,100,130);
  z-index: -999;
  transition: .5s;
}
.a a:nth-child(2):hover ~ .b {
  left: 150px;
}
.a a:nth-child(3):hover ~ .b {
  left: 300px;
}
.a a:nth-child(4):hover ~ .b {
  left: 450px;
}
.a a:nth-child(5):hover ~ .b {
  left: 600px;
}
</style>
