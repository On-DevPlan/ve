<script setup>
import Barrage3D from './components/Barrage3D.vue'
</script>

<template>
  <div id="app">
    <Barrage3D />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #16c225ff 0%, #764ba2 100%);
}
</style>
