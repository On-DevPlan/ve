<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="box">
        <img src="/gost/No42_Accordion/img (1).jpg" alt="">
        <span>Image</span>
      </div>
      <div class="box">
        <img src="/gost/No42_Accordion/img (2).jpg" alt="">
        <span>Video</span>
      </div>
      <div class="box">
        <img src="/gost/No42_Accordion/img (3).jpg" alt="">
        <span>File</span>
      </div>
      <div class="box">
        <img src="/gost/No42_Accordion/img (4).jpg" alt="">
        <span>Music</span>
      </div>
      <div class="box">
        <img src="/gost/No42_Accordion/img (5).jpg" alt="">
        <span>Lyric</span>
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
  background-color: rgb(243, 230, 241);
}

.shell {
  width: 90%;
  height: 700px;
  display: flex;
}

.box {
  flex: 1;
  overflow: hidden;
  transition: .5s;
  margin: 0 20px;
  box-shadow: 10px 10px 20px rgba(0, 0, 0, .5);
  border-radius: 20px;
  border: 10px solid #fff;
  background-color: #fff;
}

.box > img {
  width: 200%;
  height: 85%;
  object-fit: cover;
  transition: .5s;
}

.box > span {
  font: 200 45px '优设标题黑';
  text-align: center;
  height: 15%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.box:hover {
  flex-basis: 40%;
}

.box:hover > img {
  width: 100%;
  height: 100%;
}
</style>
