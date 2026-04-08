<script setup>
import { ref, onMounted } from 'vue'

const currentIndex = ref(0)

const phrases = [
  ['wǒ xǐ huān nǐ', '我 喜 欢 你', '(I LIKE YOU)'],
  ['xīn xī ruì rù', '新 喜 瑞 如', '(MAY YOU BE AS HAPPY AS THE NEW YEAR)'],
  ['shēn tǐ jiàn kāng', '身 體 健 康', '(GOOD HEALTH)'],
  ['cái yuán guǎng jìn', '财 源 广 进', '(MAY WEALTH COME POURING IN)'],
  ['wàn shì rú yì', '万 事 如 意', '(MAY EVERYTHING GO WELL)'],
  ['dà jí dà lì', '大 吉 大 利', '(GREAT LUCK AND GREAT PROFIT)'],
  ['nián nián yǒu yú', '年 年 有 餘', '(SURPLUS YEAR AFTER YEAR)'],
  ['gōng hè xīn xǐ', '恭 賀 新 禧', '(WISHING YOU A HAPPY NEW YEAR)'],
  ['xīn nián kuài lè', '新 年 快 樂', '(HAPPY NEW YEAR)']
]

const generatePhrase = () => {
  currentIndex.value = (currentIndex.value + 1) % phrases.length
}
</script>

<template>
  <div class="demo-wrapper">
    <div id="phrase">
      <span id="line1">{{ phrases[currentIndex][0] }}</span><br>
      <span id="line2">{{ phrases[currentIndex][1] }}</span><br>
      <span id="line3">{{ phrases[currentIndex][2] }}</span>
    </div>
    <button id="btn" @click="generatePhrase">祝福++</button>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #c6070c;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #ffe392;
  flex-direction: column;
}

#phrase {
  margin-bottom: 20px;
}

#line1 {
  height: 20px;
  font-size: 1.1em;
  letter-spacing: 30px;
}

#line2 {
  font: 700 8em '';
  text-align: center;
  padding: 0px;
}

#line3 {
  font-size: 3em;
}

#btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 100px;
  background-color: #ffe392;
  font-size: 30px;
  color: #c6070c;
}
</style>
