<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="a">
      <input type="text" class="b">
      <a href="#" class="c">
        <img src="/gost/No11_DynamicSearch/搜索框.png" style="width: 30px;">
      </a>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #e94118;
}
.a {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%,-50%);
  background-color: #2f3640;
  height: 40px;
  border-radius: 40px;
  padding: 10px;
}
.a:hover .b {
  width: 200px;
  padding: 0 6px;
}
.a:hover .c {
  background-color: wheat;
}
.b {
  border: none;
  background: none;
  outline: none;
  width: 0;
  padding: 0;
  transition: .4s;
  line-height: 40px;
  font-size: 20px;
  color: wheat;
}
.c {
  color: #e94118;
  float: right;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #2f3640;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: .4s;
}
</style>
