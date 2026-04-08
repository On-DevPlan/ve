<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="a">
      <div class="b"></div>
      <div class="c"></div>
      <div class="d"></div>
      <div class="e"></div>
      <p class="f">LONELY GOAT</p>
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
  background-color: rgb(119 157 193);
}
.a {
  position: relative;
  top: 100px;
  width: 1000px;
  height: 600px;
  border: 10px solid white;
  background-image: url("/gost/No14_ParallaxCard/163727-15190294471b41.jpg");
  background-size: cover;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.b,
.c,
.d,
.e {
  position: absolute;
  width: 500px;
  height: 600px;
  background-image: url("/gost/No14_ParallaxCard/163727-15190294471b41.jpg");
  background-color: rgb(15, 15, 13);
  filter: drop-shadow(4px 4px 12px rgb(0, 0, 0));
  background-size: cover;
  opacity: .6;
  transition: 1.5s;
}
.b {
  left: 0;
  clip-path: polygon(0% 0%, 0% 100%, 100% 100%, 65% 0%);
  background-position: -100px 0;
}
.c {
  left: 0;
  clip-path: polygon(0% 0%, 0% 100%, 70% 100%, 90% 0%);
  background-position: -100px 0;
}
.d {
  right: 0;
  clip-path: polygon(0% 0%, 40% 100%, 100% 100%, 100% 0%);
  background-position: 800px 0;
}
.e {
  right: 0;
  clip-path: polygon(20% 0%, 0% 100%, 100% 100%, 100% 0%);
  background-position: 800px 0;
}
.b, .c, .d, .e {
  background-image: url("/gost/No14_ParallaxCard/163727-15190294471b41.jpg");
}
.a:hover .b {
  left: -200px;
}
.a:hover .c {
  left: -150px;
}
.a:hover .d {
  right: -140px;
}
.a:hover .e {
  right: -220px;
}
.a:hover div {
  opacity: 1;
}
.f {
  opacity: 0;
  font: 900 50px '';
  letter-spacing: 10px;
  color: rgb(60, 60, 70);
  transition: 1.5s;
}
.a:hover .f {
  opacity: 1;
}
</style>
