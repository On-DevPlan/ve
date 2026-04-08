<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="image" style="background-image: url('https://picsum.photos/1920/1080?random=261');"></div>
      <div class="heading">
        <h1>When you are confused</h1>
      </div>
      <div class="text">
        <h1>Set goals in your mind</h1>
      </div>

      <div class="image" style="background-image: url('https://picsum.photos/1920/1080?random=262');"></div>
      <div class="heading">
        <h1>When you're down</h1>
      </div>
      <div class="text">
        <h1>Try to wake up the beast in your heart</h1>
      </div>

      <div class="image" style="background-image: url('https://picsum.photos/1920/1080?random=263');"></div>
      <div class="heading">
        <h1>When prople leave you</h1>
      </div>
      <div class="text">
        <h1>It's time to start your season</h1>
      </div>

      <div class="image" style="background-image: url('https://picsum.photos/1920/1080?random=264');"></div>
      <div class="heading">
        <h1>Come on, stranger.</h1>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow-x: hidden;
  margin: 0;
}
* {
  padding: 0;
  margin: 0;
}
.shell {
  height: 100vh;
  overflow-x: hidden;
  perspective: 3px;
}
.shell div {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  font-style: 30px;
  letter-spacing: 2px;
}
.image {
  transform: translateZ(-1px) scale(1.6);
  background-size: cover;
  height: 100vh;
  z-index: -1;
}
.text {
  height: 50vh;
  background-color: #fff;
}
.text h1 {
  color: #000;
}
.heading {
  z-index: -1;
  transform: translateY(-30vh) translateZ(1px);
  color: #fff;
  font-size: 30px;
}
</style>
