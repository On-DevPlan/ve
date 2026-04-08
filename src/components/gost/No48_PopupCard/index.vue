<script setup>
// No JS needed for this demo
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="person">
        <div class="box">
          <img src="/gost/No48_PopupCard/background.png" class="circle">
          <img src="/gost/No48_PopupCard/1.png" class="img">
        </div>
        <div class="wire"></div>
        <div class="name">JENNIE</div>
        <div class="birthday">January 16, 1996</div>
      </div>

      <div class="person">
        <div class="box">
          <img src="/gost/No48_PopupCard/background.png" class="circle">
          <img src="/gost/No48_PopupCard/1.png" class="img">
        </div>
        <div class="wire"></div>
        <div class="name">JENNIE</div>
        <div class="birthday">January 16, 1996</div>
      </div>

      <div class="person">
        <div class="box">
          <img src="/gost/No48_PopupCard/background.png" class="circle">
          <img src="/gost/No48_PopupCard/1.png" class="img">
        </div>
        <div class="wire"></div>
        <div class="name">JENNIE</div>
        <div class="birthday">January 16, 1996</div>
      </div>

      <div class="person">
        <div class="box">
          <img src="/gost/No48_PopupCard/background.png" class="circle">
          <img src="/gost/No48_PopupCard/1.png" class="img">
        </div>
        <div class="wire"></div>
        <div class="name">JENNIE</div>
        <div class="birthday">January 16, 1996</div>
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
  background-color: rgb(255, 252, 245);
  font-family: "Merriweather", serif;
}

.shell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.person {
  display: flex;
  align-items: center;
  flex-direction: column;
  width: 300px;
  margin: 0 50px;
}

.box {
  height: 500px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  clip-path: inset(0 0 0 0 round 0 0 520px 520px);
}

.circle {
  border-radius: 50%;
  width: 100%;
  position: absolute;
  bottom: 0;
  transition: transform .3s;
}

.img {
  position: relative;
  width: 80%;
  transform: translateY(80px);
  transition: transform .3s;
}

.box:hover .img {
  transform: translateY(26px) scale(1.2);
}

.box:hover .circle {
  transform: rotate(20deg);
}

.wire {
  background-color: rgb(200, 115, 123);
  height: 2px;
  width: 200px;
  margin: 20px 0;
}

.name {
  color: #404245;
  font-size: 36px;
  font-weight: 600;
}

.birthday {
  color: #6e6e6e;
  font: 100 14px 'arial';
  font-style: italic;
}
</style>
