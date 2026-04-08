<template>
  <div class="demo-wrapper">
    <div class="a">
      <div class="b"><img src="/gost/No2_WindowBlind/1.gif"></div>
      <div class="b"><img src="/gost/No2_WindowBlind/2.gif"></div>
      <div class="b"><img src="/gost/No2_WindowBlind/3.gif"></div>
      <div class="b"><img src="/gost/No2_WindowBlind/4.gif"></div>
      <div class="b"><img src="/gost/No2_WindowBlind/5.gif"></div>
      <div class="b"><img src="/gost/No2_WindowBlind/6.gif"></div>
      <div class="b"><img src="/gost/No2_WindowBlind/7.gif"></div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #7f8c8d;
  display: flex;
  justify-content: center;
}
.a {
  width: 900px;
  height: 300px;
  position: relative;
  top: 200px;
  overflow: hidden;
  display: flex;
  justify-content: center;
}
.b {
  transition: .7s;
  overflow: hidden;
}
.b:hover {
  flex-shrink: 0;
  flex-grow: 0;
}
img {
  width: 400px;
}
</style>
