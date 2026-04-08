<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // Create 8 tree layers
  for (let i = 1; i <= 8; i++) {
    let tree = document.createElement('div')
    tree.classList.add('trees')
    tree.style.width = (i * 60) + 'px'
    document.querySelector('.tree').appendChild(tree)
  }

  // Set random colors for boxes
  const colors = ["#f4d348", "#37799e", "#bb3e39", "#e388b1"]
  const colorCount = {}
  const boxes = document.querySelectorAll(".box")
  boxes.forEach(box => {
    let randomColor = colors[Math.floor(Math.random() * colors.length)]
    while (colorCount[randomColor] >= 2) {
      randomColor = colors[Math.floor(Math.random() * colors.length)]
    }
    box.style.backgroundColor = randomColor
    colorCount[randomColor] = (colorCount[randomColor] || 0) + 1
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="xmas">
      <div class="tree">
        <div class="ball">
          <div class="box" style="--x:25;--y:8;"></div>
          <div class="box" style="--x:15;--y:23;"></div>
          <div class="box" style="--x:30;--y:23;"></div>
          <div class="box" style="--x:10;--y:30;"></div>
          <div class="box" style="--x:20;--y:28;"></div>
          <div class="box" style="--x:35;--y:33;"></div>
          <div class="box" style="--x:17;--y:12;"></div>
          <div class="box" style="--x:24;--y:17;"></div>
        </div>
      </div>
      <div class="trunk"></div>
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
  background-color: beige;
}

* {
  padding: 0;
  margin: 0;
}

.xmas,
.tree {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.tree {
  position: relative;
}

.box {
  width: 40px;
  height: 40px;
  position: absolute;
  border-radius: 50px;
  left: calc(var(--x)*10px);
  top: calc(var(--y)*10px);
}

.trunk {
  width: 50px;
  height: 70px;
  background-color: #9e6328;
}

.trees {
  height: 50px;
  border-radius: 50px;
}

.tree div,
.trunk {
  box-shadow: 10px 10px 22px #1c4d1c;
}

.tree div:nth-child(4n+1) {
  background: #2d6359;
}

.tree div:nth-child(4n+2) {
  background: #32776a;
}

.tree div:nth-child(4n+3) {
  background: #268b4c;
}

.tree div:nth-child(4n+4) {
  background: #459763;
}
</style>
