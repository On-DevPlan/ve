<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <a href="#" class="box"><span class="icon">&#9776;</span><span class="label">list</span></a>
      <a href="#" class="box"><span class="icon">&#128088;</span><span class="label"> Warehouse</span></a>
      <a href="#" class="box"><span class="icon">&#127912;</span><span class="label">theme</span></a>
      <a href="#" class="box"><span class="icon">&#128176;</span><span class="label">wallet</span></a>
      <a href="#" class="box"><span class="icon">&#128444;</span><span class="label">picture</span></a>
      <a href="#" class="box"><span class="icon">&#qrcode;</span><span class="label">QR code</span></a>
      <a href="#" class="box"><span class="icon">&#128737;</span><span class="label">authentication</span></a>
      <a href="#" class="box"><span class="icon">&#128682;</span><span class="label">cancellation</span></a>
    </div>

    <div class="shell">
      <a href="#" class="box"><span class="icon">&#9776;</span><span class="label">list</span></a>
      <a href="#" class="box"><span class="icon">&#128088;</span><span class="label"> Warehouse</span></a>
      <a href="#" class="box"><span class="icon">&#127912;</span><span class="label">theme</span></a>
      <a href="#" class="box"><span class="icon">&#128176;</span><span class="label">wallet</span></a>
      <a href="#" class="box"><span class="icon">&#128444;</span><span class="label">picture</span></a>
      <a href="#" class="box"><span class="icon">&#qrcode;</span><span class="label">QR code</span></a>
      <a href="#" class="box"><span class="icon">&#128737;</span><span class="label">authentication</span></a>
      <a href="#" class="box"><span class="icon">&#128682;</span><span class="label">cancellation</span></a>
    </div>

    <div class="shell">
      <a href="#" class="box"><span class="icon">&#9776;</span><span class="label">list</span></a>
      <a href="#" class="box"><span class="icon">&#128088;</span><span class="label"> Warehouse</span></a>
      <a href="#" class="box"><span class="icon">&#127912;</span><span class="label">theme</span></a>
      <a href="#" class="box"><span class="icon">&#128176;</span><span class="label">wallet</span></a>
      <a href="#" class="box"><span class="icon">&#128444;</span><span class="label">picture</span></a>
      <a href="#" class="box"><span class="icon">&#qrcode;</span><span class="label">QR code</span></a>
      <a href="#" class="box"><span class="icon">&#128737;</span><span class="label">authentication</span></a>
      <a href="#" class="box"><span class="icon">&#128682;</span><span class="label">cancellation</span></a>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: rgb(209, 213, 219);
  display: flex;
  justify-content: space-evenly;
  align-items: center;
}
.shell {
  width: 100px;
  height: 700px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  background-color: rgb(17, 24, 39);
  border-radius: 10px;
  transition: .3s;
  overflow: hidden;
}
.box {
  display: block;
  height: 15%;
  width: 85%;
  margin: 9px;
  border-radius: 5px;
  position: relative;
  transition: .3s;
  color: rgb(160, 160, 175);
  text-decoration: none;
}
.box .icon {
  font-size: 60px;
  position: absolute;
  margin: 7px 0 0 13px;
}
.box:nth-child(1)::before,
.box:nth-child(5)::before {
  content: '';
  display: block;
  width: 100%;
  height: 2px;
  background-color: rgb(55, 65, 81);
  position: absolute;
  bottom: -10px;
}
.box .label {
  position: relative;
  top: 22px;
  left: 80px;
  font: 500 20px '';
  opacity: 0;
  transition: .1s;
}
.shell:hover {
  width: 270px;
}
.box:hover {
  background-color: rgb(55, 65, 81);
}
.shell:hover .label {
  opacity: 1;
}
.box:hover {
  color: #fff;
}
.shell:nth-child(2) {
  background-color: rgb(243, 244, 246);
}
.shell:nth-child(2) .box:hover {
  background-color: rgb(209, 213, 219);
  color: rgb(241, 159, 159);
}
.shell:nth-child(2) .box {
  color: #000;
}
.shell:nth-child(3) {
  background-color: rgb(49, 46, 129);
}
.shell:nth-child(3) .box:hover {
  background-color: rgb(67, 56, 202);
}
.shell:nth-child(3) .box {
  color: rgb(140, 120, 240);
}
</style>
