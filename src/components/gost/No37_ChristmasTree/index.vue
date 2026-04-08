<script setup>
import { ref, onMounted } from 'vue'

const treeRef = ref(null)

onMounted(() => {
  const tree = treeRef.value
  for (let i = 0; i < 128; i++) {
    const li = document.createElement('li')
    li.style = '--i:' + i
    tree.appendChild(li)
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <ul ref="treeRef" class="tree">
      <div class="star"></div>
    </ul>
  </div>
</template>

<style scoped>
* {
  padding: 0;
  margin: 0;
  list-style: none;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgb(54, 66, 70);
}

.tree {
  position: relative;
  width: 500px;
  height: 700px;
  display: flex;
  justify-content: center;
}

.star {
  width: 50px;
  height: 50px;
  position: absolute;
  background-color: rgb(236, 234, 167);
  z-index: 999;
  margin-bottom: 40px;
  clip-path: polygon(
    50% 0,
    65% 40%,
    100% 40%,
    72% 60%,
    85% 100%,
    50% 75%,
    15% 100%,
    28% 60%,
    0 40%,
    35% 40%
  );
}
.tree li {
  position: absolute;
  top: 25px;
  width: 2px;
  background: linear-gradient(
    rgba(46, 204, 113, 0),
    rgba(46, 204, 113, 0.25)
  );
  transform-origin: 50% 0;
  animation: swing 4s ease-in-out infinite;
  height: calc(var(--i) * 4px);
  animation-delay: calc(var(--i) * -0.23s);
}
@keyframes swing {
  0%,
  100% {
    transform: rotate(-30deg);
  }
  5%,
  45% {
    opacity: 0.25;
  }
  0%,
  50%,
  100% {
    opacity: 1;
  }
  50% {
    transform: rotate(30deg);
  }
}
.tree li::before {
  content: '';
  position: absolute;
  left: -1px;
  bottom: 1px;
  width: 3px;
  height: 3px;
}
.tree li:nth-child(4n)::before {
  background-color: #d8334a;
}
.tree li:nth-child(4n + 1)::before {
  background-color: #ffce54;
}
.tree li:nth-child(4n + 2)::before {
  background-color: #2ecc71;
}
.tree li:nth-child(4n + 3)::before {
  background-color: #5d9cec;
}
</style>
