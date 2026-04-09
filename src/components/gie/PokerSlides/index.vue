<template>
  <div class="demo-wrapper">
    <div class="container">
      <div
        v-for="poker in pokers"
        :key="poker.id"
        class="poker"
        :class="'poker' + (poker.nums + 1)"
        :style="{ zIndex: poker.nums }"
      >
        <img :src="'/gie/PokerSlides/photo (' + poker.imgIndex + ').webp'" />
      </div>
      <div
        class="poker_top"
        :class="'poker' + (topNums + 1)"
        :style="{ zIndex: topNums }"
        @click="move"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const transformData = [
  'rotate(-10deg)',
  'rotate(-6deg) translate(35%, -12%)',
  'rotate(-2deg) translate(65%, -19%)',
  'rotate(2deg) translate(95%, -26%)',
  'rotate(6deg) translate(125%, -23%)'
]

const pokers = ref([
  { id: 0, nums: 0, imgIndex: 8 },
  { id: 1, nums: 1, imgIndex: 7 },
  { id: 2, nums: 2, imgIndex: 6 },
  { id: 3, nums: 3, imgIndex: 5 },
  { id: 4, nums: 4, imgIndex: 4 }
])

const topNums = computed(() => 4)

const move = () => {
  pokers.value = pokers.value.map((poker) => {
    let nums = poker.nums
    let imgIndex = poker.imgIndex
    if (nums + 1 >= pokers.value.length) {
      nums = 0
      imgIndex = (imgIndex + 1) % 10
    } else {
      nums += 1
    }
    return { ...poker, nums, imgIndex }
  })
}
</script>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  position: absolute;
  width: 45rem;
  height: 25rem;
  margin-bottom: 1rem;
}

.poker {
  position: absolute;
  width: 20rem;
  height: 26rem;
  border: 0.15rem solid #fff;
  border-radius: 1.5rem;
  background-color: #17f700;
  overflow: hidden;
}

.poker img {
  position: relative;
  width: 100%;
}

.poker_top {
  position: absolute;
  width: 20rem;
  height: 26rem;
  border: 0.15rem solid #fff;
  border-radius: 1.5rem;
  background-color: #fff;
  transition: 0.3s ease;
  cursor: pointer;
}

.poker_top:hover {
  background-color: #aaa;
}

/* Transform classes applied via :class */
.poker1 { transform: rotate(-10deg); }
.poker2 { transform: rotate(-6deg) translate(35%, -12%); }
.poker3 { transform: rotate(-2deg) translate(65%, -19%); }
.poker4 { transform: rotate(2deg) translate(95%, -26%); }
.poker5 { transform: rotate(6deg) translate(125%, -23%); }
</style>
