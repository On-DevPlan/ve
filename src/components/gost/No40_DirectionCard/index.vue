<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="box">
        <div class="images">
          <img src="/gost/No40_DirectionCard/1.png" alt="">
        </div>
        <div class="content">
          <h2>ZeenChin</h2>
          <p>The style in the painting integrates temptation, fantasy and strangeness
          </p>
        </div>
      </div>
      <div class="box">
        <div class="images">
          <img src="/gost/No40_DirectionCard/2.png" alt="">
        </div>
        <div class="content">
          <h2>ZeenChin</h2>
          <p>The style in the painting integrates temptation, fantasy and strangeness
          </p>
        </div>
      </div>
      <div class="box">
        <div class="images">
          <img src="/gost/No40_DirectionCard/3.png" alt="">
        </div>
        <div class="content">
          <h2>ZeenChin</h2>
          <p>The style in the painting integrates temptation, fantasy and strangeness
          </p>
        </div>
      </div>
      <div class="box">
        <div class="images">
          <img src="/gost/No40_DirectionCard/4.png" alt="">
        </div>
        <div class="content">
          <h2>ZeenChin</h2>
          <p>The style in the painting integrates temptation, fantasy and strangeness
          </p>
        </div>
      </div>
      <div class="box">
        <div class="images">
          <img src="/gost/No40_DirectionCard/5.png" alt="">
        </div>
        <div class="content">
          <h2>ZeenChin</h2>
          <p>The style in the painting integrates temptation, fantasy and strangeness
          </p>
        </div>
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
  background-color: rgb(210, 210, 220);
}

.shell {
  position: relative;
  min-width: 1000px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  transform-style: preserve-3d;
  perspective: 900px;
}

.shell .box {
  position: relative;
  width: 250px;
  height: 350px;
  transition: 0.3s;
  overflow: hidden;
  margin: 30px;
  transform: rotateY(0deg);
  transition-delay: .1s;
  border-radius: 5px;
  border: #fff 5px solid;
}

.shell:hover .box {
  transform: rotateY(20deg);
}

.shell .box:hover {
  transform: rotateY(0deg) scale(1.25);
  box-shadow: 0 25px 40px rgba(0, 0, 0, 0.7);
  z-index: 1;
}

.shell .box:hover ~ .box {
  transform: rotateY(-20deg);
}

.shell .box .images img {
  width: 100%;
}

.shell .box .content {
  position: absolute;
  top: 0;
  width: 90%;
  height: 100%;
  z-index: 999;
  padding: 15px;
}

.shell .box .content h2 {
  color: rgb(210, 140, 140);
  transition: 0.3s;
  font-size: 20px;
  transform: translateY(-100px);
}

.shell .box:hover .content h2 {
  transform: translateY(-15px);
}

.shell .box .content p {
  color: rgb(0, 0, 0);
  transition: 0.3s;
  font-size: 14px;
  transform: translateY(600px);
  background-color: rgba(255, 255, 255, 0.7);
}

.shell .box:hover .content p {
  transform: translateY(220px);
}
</style>
