<script setup>
// Pure CSS animated bubble - no JavaScript needed
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="box">
        <div class="ball"></div>
        <div class="shadow"></div>
      </div>
      <div class="box">
        <div class="ball"></div>
        <div class="shadow"></div>
      </div>
      <div class="box">
        <div class="ball"></div>
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
  background-image: linear-gradient(to bottom right,
    #91defe, #99c0f9, #bdb6ec, #d7b3e3, #efb3d5, #f9bccc);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.shell {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 500px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.box {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 500px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.ball {
  animation: float 3.5s ease-in-out infinite;
  height: 200px;
  width: 200px;
  border-radius: 50%;
  position: relative;
  background: radial-gradient(circle at 77% 30%,
    white 5px, aqua 8%, darkblue 60%, aqua 100%);
  box-shadow: inset 0 0 20px #fff,
    inset 10px 0 46px #eaf5fc,
    inset 88px 0px 60px #c2d8fe,
    inset -20px -60px 100px #fde9ea,
    inset 0 50px 140px #fde9ea,
    0 0 90px #fff;
}

.box:nth-child(2) { z-index: -999; }
.box:nth-child(2) .ball {
  left: -80px;
  top: 35px;
  width: 100px;
  height: 100px;
  z-index: -999;
  opacity: 0.5;
}

.box:nth-child(3) .ball {
  left: 80px;
  top: -80px;
  width: 20px;
  height: 20px;
  opacity: 0.1;
}

.shadow {
  background: #b490b27c;
  width: 150px;
  height: 40px;
  top: 70%;
  animation: expand 4s infinite;
  position: absolute;
  border-radius: 50%;
}

.box:nth-child(2) .shadow {
  width: 90px;
  height: 20px;
  top: 72.5%;
  left: -75px;
  opacity: 0.4;
}

@keyframes float {
  0% { transform: translatey(0px) rotate(-10deg); }
  50% { transform: translatey(-80px) rotate(10deg); }
  100% { transform: translatey(0px) rotate(-10deg); }
}

@keyframes expand {
  0%, 100% { transform: scale(0.5); }
  50% { transform: scale(1); }
}
</style>
