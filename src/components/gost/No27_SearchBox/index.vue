<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <input type="checkbox" id="checkbox">
      <label for="checkbox"></label>
      <input type="text" class="input" id="input">
      <div class="fonts">
        <span style="--i:1">S</span>
        <span style="--i:2">e</span>
        <span style="--i:3">a</span>
        <span style="--i:4">r</span>
        <span style="--i:5">c</span>
        <span style="--i:6">h</span>
        <span style="--i:7">.</span>
        <span style="--i:8">.</span>
        <span style="--i:9">.</span>
        <span style="--i:10">.</span>
        <span style="--i:11">.</span>
        <span style="--i:12">.</span>
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
  background: #140f1d;
}
* {
  margin: 0;
  padding: 0;
  background-size: cover;
}

.shell {
  position: relative;
}

.input {
  padding: 10px;
  width: 80px;
  height: 80px;
  background: none;
  border: 4px solid rgb(255, 210, 45);
  border-radius: 20px;
  box-sizing: border-box;
  font: 400 26px Comic Sans Ms;
  color: rgba(255, 210, 45, 0.2);
  outline: none;
  transition: 0.5s;
}
#checkbox {
  display: none;
}
[for='checkbox'] {
  display: block;
  width: 70px;
  height: 70px;
  border-radius: 20px;
  position: absolute;
  right: 0;
  margin: 4px;
  transition: 0.4s;
  background-image: url('https://picsum.photos/70/70?random=271');
  background-size: cover;
  cursor: pointer;
}
#checkbox:checked ~ label {
  border-radius: 10px;
  background-image: url('https://picsum.photos/70/70?random=272');
  border: 4px solid rgb(255, 210, 45);
  margin: 0 -5px;
}
#checkbox:checked ~ input {
  width: 400px;
  border-radius: 10px;
  margin-right: 80px;
  background-color: #272133;
  color: rgb(255, 210, 45);
}
.fonts {
  position: absolute;
  top: 0;
  left: 10px;
  color: rgb(255, 210, 45);
  letter-spacing: 5px;
  font: 400 26px Comic Sans Ms;
  display: flex;
}
.fonts span {
  transition: 0.3s;
  opacity: 0;
}
#checkbox:checked ~ .fonts span {
  transition: calc(var(--i) * 0.1s) 0.3s;
  transform: translateY(-40px);
  opacity: 1;
}
</style>
