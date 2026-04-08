<script setup>
import { ref, onMounted } from 'vue'

const shellRef = ref(null)

onMounted(() => {
  const shell = shellRef.value
  if (!shell) return

  const handleMouseMove = (e) => {
    const items = shell.querySelectorAll('.item')
    const mouseX = e.clientX
    const mouseY = e.clientY

    items.forEach(sqr => {
      const rect = sqr.getBoundingClientRect()
      const sqrX = rect.left + rect.width / 2
      const sqrY = rect.top + rect.height / 2

      const diffX = mouseX - sqrX
      const diffY = mouseY - sqrY

      const radians = Math.atan2(diffY, diffX)
      const angle = radians * 180 / Math.PI

      sqr.style.transform = `rotate(${angle}deg)`
    })
  }

  shell.addEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div class="demo-wrapper" @mousemove="handleMouseMove">
    <div class="shell" ref="shellRef">
      <div class="item" v-for="n in 49" :key="n"></div>
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
  background-color: #eed9eba9;
}
* {
  margin: 0;
  padding: 0;
}
.shell {
  display: grid;
  grid-template-columns: repeat(7, 40px);
  grid-template-rows: repeat(7, 40px);
  grid-gap: 1.5rem;
}
.item {
  background-color: rgb(40, 40, 40);
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  border-left: solid 10px #fff;
  position: relative;
}
.item::after,
.item::before {
  content: '';
  width: 5px;
  height: 5px;
  display: block;
  position: absolute;
  border-radius: 50%;
  left: 20px;
  background-color: #fff;
}
.item::after {
  top: 25px;
}
.item::before {
  bottom: 25px;
}
</style>
