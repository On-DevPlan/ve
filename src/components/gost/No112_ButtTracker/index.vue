<script setup>
import { ref, onMounted } from 'vue'

const boxRef = ref(null)

onMounted(() => {
  const el = boxRef.value
  if (!el) return

  const moveHandler = (e) => {
    el.style.setProperty("--pointer-x", `${e.clientX}px`)
    el.style.setProperty("--pointer-y", `${e.clientY}px`)
  }

  const leaveHandler = () => {
    el.style.removeProperty("--pointer-x")
    el.style.removeProperty("--pointer-y")
  }

  document.addEventListener("pointermove", moveHandler)
  document.addEventListener("pointerleave", leaveHandler)

  return () => {
    document.removeEventListener("pointermove", moveHandler)
    document.removeEventListener("pointerleave", leaveHandler)
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <dialog class="box" ref="boxRef" open>
      <img src="/gost/No112_ButtTracker/image/17.gif" style="width: 100%;height: 100%;" alt="">
    </dialog>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-image: linear-gradient(to bottom left, #65ceff, #27a9ff);
}

.box {
  position: fixed;
  inset: 0;
  margin: 0;
  z-index: 100;
  --x: clamp(50%, var(--pointer-x, 50vw), 100vw - 50%);
  --y: clamp(50%, var(--pointer-y, 50vh), 100vh - 50%);
  transform: translate(var(--x), var(--y)) translate(-50%, -50%);
  transition: transform 0.9s linear(0, 1.3 10%, 0.8 25%, 1.1 35%, 1);
  background-color: transparent;
  border: none;
}
</style>
