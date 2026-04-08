<template>
  <div class="demo-wrapper" @click="handleClick">
    <span
      v-for="span in spans"
      :key="span.id"
      :style="{ left: span.x + 'px', top: span.y + 'px', opacity: span.opacity, transform: span.transform }"
    >{{ span.text }}</span>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const arr = [
  "在这披霜戴雪的冬日，一头扎进这沸腾的生命",
  "命运如同手中的掌纹，无论多么曲折，始终掌握在你的手里",
  "少言自寡，胜过千言万语",
  "千万不要在奋斗的年纪选择安逸",
  "除了你自己，没人会时刻在意你",
  "命运的每一个玩去，都是你走向成功的一个转折",
  "年少的期待，都会在日后被一一兑现，哪怕它们换了形态，且姗姗来迟",
  "当你不能拥有的时候，唯一能做的便是不能忘记",
  "如果命运是条孤独的河流，那么你就是你的灵魂摆渡人",
  "燃烧，使你获得最终的宁静",
  "生命的价值，在于始终坚持一个目标",
  "没办法，我喜欢她，我对得起自己的喜欢",
  "不求苍天俯就我的美意，但求永远恣意挥洒",
  "每个人心底都有一座坟墓，是用来埋葬所爱的人",
  "黑夜无论多么漫长，白昼总会到来",
  "无论谁，领先一步，都是暂时的",
  "这是黄昏的太阳，我却当做是黎明的曙光",
  "人生处处有诱惑，贪欲者自上钩",
  "认知自己的无知是最大的智慧",
  "一路曲折，换来的是生命的成长",
  "既然已经伤害了过去，就不要再辜负将来",
  "人类最大的勇气就是豁出去的心",
  "人成熟的标志在于，该动脑时，不在动情",
  "对美好的追求，对残缺的接纳",
  "青春时光转瞬即逝",
  "生活不是一种刁难，而是一种雕刻",
  "永远不要在别人面前调侃你的理想，你为他付出的是生命",
  "凡是都有偶然的凑巧，结果却如宿命般的必然",
  "总之岁月漫长，所有值得等待"
]

const spans = ref([])
let spanId = 0
const timeoutIds = []

const handleClick = (e) => {
  const text = arr[Math.floor(Math.random() * arr.length)]
  const id = ++spanId

  const span = {
    id,
    x: e.clientX,
    y: e.clientY,
    text,
    opacity: '0',
    transform: 'translateY(0px)'
  }

  // Add to reactive array
  spans.value.push(span)

  // Fade in animation
  const t1 = setTimeout(() => {
    const s = spans.value.find(s => s.id === id)
    if (s) {
      s.opacity = '1'
      s.transform = 'translateY(-100px)'
    }
  }, 100)
  timeoutIds.push(t1)

  // Fade out and remove
  const t2 = setTimeout(() => {
    spans.value = spans.value.filter(s => s.id !== id)
  }, 1600)
  timeoutIds.push(t2)
}

onUnmounted(() => {
  timeoutIds.forEach(id => clearTimeout(id))
})
</script>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: rgb(35, 35, 35);
}
span {
  user-select: none;
  cursor: default;
  font-size: 20px;
  color: blanchedalmond;
  position: absolute;
  transition: 1s;
}
</style>
