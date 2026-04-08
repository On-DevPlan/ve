<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const sceneRef = ref(null)
let parallaxInstance = null

const movies = [
  { title: '起风了 風立ちぬ (2013)', img: '/gost/No60_MouseFollowGallery/1.jpg' },
  { title: '千与千寻 千と千尋の神隠し (2001)', img: '/gost/No60_MouseFollowGallery/2.jpg' },
  { title: '哈尔的移动城堡 ハウルの動く城 (2004)', img: '/gost/No60_MouseFollowGallery/3.jpg' },
  { title: '魔女宅急便 魔女の宅急便 (1989)', img: '/gost/No60_MouseFollowGallery/4.jpg' },
  { title: '龙猫 となりのトトロ (1988)', img: '/gost/No60_MouseFollowGallery/5.jpg' },
  { title: '崖上的波妞 崖の上のポニョ (2008)', img: '/gost/No60_MouseFollowGallery/6.jpg' },
  { title: '借东西的小人阿莉埃蒂 借りぐらしのアリエッティ (2010)', img: '/gost/No60_MouseFollowGallery/7.jpg' },
  { title: '风之谷 風の谷のナウシカ (1984)', img: '/gost/No60_MouseFollowGallery/8.jpg' },
  { title: '幽灵公主 もののけ姫 (1997)', img: '/gost/No60_MouseFollowGallery/9.jpg' },
  { title: '萤火虫之墓 火垂るの墓 (1988)', img: '/gost/No60_MouseFollowGallery/10.jpg' },
  { title: '大鱼海棠 (2016)', img: '/gost/No60_MouseFollowGallery/11.jpg' },
  { title: '你的名字。 君の名は。 (2016)', img: '/gost/No60_MouseFollowGallery/12.jpg' },
  { title: '言叶之庭 言の葉の庭 (2013)', img: '/gost/No60_MouseFollowGallery/13.jpg' },
  { title: '秒速5厘米 秒速5センチメートル (2007)', img: '/gost/No60_MouseFollowGallery/14.jpg' },
  { title: '铃芽之旅 すずめの戸締まり (2022)', img: '/gost/No60_MouseFollowGallery/15.jpg' },
  { title: '天气之子 天気の子 (2019)', img: '/gost/No60_MouseFollowGallery/16.jpg' },
  { title: '飞屋环游记 Up (2009)', img: '/gost/No60_MouseFollowGallery/17.jpg' },
  { title: '萤火之森 蛍火の杜へ (2011)', img: '/gost/No60_MouseFollowGallery/18.jpg' },
  { title: '侧耳倾听 耳をすませば (1995)', img: '/gost/No60_MouseFollowGallery/19.jpg' },
  { title: '穿越时空的少女 時をかける少女 (2006)', img: '/gost/No60_MouseFollowGallery/20.jpg' },
  { title: '魔发奇缘 Tangled (2010)', img: '/gost/No60_MouseFollowGallery/21.jpg' },
  { title: '鬼妈妈 Coraline (2009)', img: '/gost/No60_MouseFollowGallery/22.jpg' },
  { title: '魁拔之十万火急 (2011)', img: '/gost/No60_MouseFollowGallery/23.jpg' },
  { title: '哆啦A梦：伴我同行 STAND BY ME ドラえもん (2014)', img: '/gost/No60_MouseFollowGallery/24.jpg' },
  { title: '给桃子的信 ももへの手紙 (2011)', img: '/gost/No60_MouseFollowGallery/25.jpg' },
  { title: '罗小黑战记 (2019)', img: '/gost/No60_MouseFollowGallery/26.jpg' },
  { title: '最终幻想7：圣子降临 ファイナルファンタジーⅦ アドベンチャルドレン (2005)', img: '/gost/No60_MouseFollowGallery/27.jpg' },
  { title: '藏獒多吉 (2011)', img: '/gost/No60_MouseFollowGallery/28.jpg' },
  { title: '意外的幸运签 カラフル (2010)', img: '/gost/No60_MouseFollowGallery/29.jpg' },
  { title: '鬼灭之刃 柱众会议・蝶屋敷篇 鬼滅の刃 柱合会議・蝶屋敷編 (2020)', img: '/gost/No60_MouseFollowGallery/30.jpg' },
  { title: '十万个冷笑话 (2014)', img: '/gost/No60_MouseFollowGallery/31.jpg' },
  { title: '猫和老鼠：魔法戒指 Tom and Jerry: The Magic Ring (2002)', img: '/gost/No60_MouseFollowGallery/32.jpg' },
]

const makeWinHeight = () => {
  if (!sceneRef.value) return
  const vh = window.innerHeight
  const projects = vh / 2
  sceneRef.value.style.height = vh + 'px'
  const mainLayer = sceneRef.value.querySelector('.layer.main')
  if (mainLayer) mainLayer.style.height = vh + 'px'
  const cols = sceneRef.value.querySelectorAll('.col')
  cols.forEach(col => {
    const a = col.querySelector('a')
    if (a) a.style.height = projects + 'px'
    col.style.height = projects + 'px'
  })
}

onMounted(async () => {
  // Load jQuery and Parallax.js from CDN
  if (!window.jQuery) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  if (!window.Parallax) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/parallax/2.1.3/parallax.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  makeWinHeight()

  if (sceneRef.value) {
    parallaxInstance = new window.Parallax(sceneRef.value)
  }

  window.addEventListener('resize', makeWinHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', makeWinHeight)
  if (parallaxInstance) parallaxInstance = null
})
</script>

<template>
  <div class="demo-wrapper">
    <section id="scene" ref="sceneRef" data-scalar-y="150.0" data-scalar-x="100.0">
      <div class="layer main" data-depth="1.0">
        <div class="col" v-for="movie in movies" :key="movie.title">
          <a href="#">
            <div class="hover">
              <div class="pad align-bottom">
                <h2>{{ movie.title }}</h2>
              </div>
            </div>
            <div class="bg-img" :style="{ backgroundImage: 'url(' + movie.img + ')' }">
            </div>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
}

* {
  padding: 0;
  margin: 0;
}

#scene {
  background-color: rgb(145, 151, 242);
  position: relative;
  overflow: hidden;
  width: 100%;
}

.layer {
  pointer-events: none;
}

h2 {
  font-size: 18px;
  width: 90%;
}

.col {
  display: inline-block;
  float: left;
  overflow: hidden;
  position: relative;
  width: 12.5%;
  pointer-events: all;
  overflow: initial;
  margin: 0 0 30px;
}

.layer.main {
  width: 150%;
  position: absolute;
  z-index: 1;
  padding: 20px;
}

.col a {
  display: block;
  margin: 15px;
  overflow: hidden;
  box-shadow: 0px 16px 32px rgba(0, 0, 0, 0.37);
}

.col a .hover {
  position: absolute;
  top: 15px;
  right: 15px;
  bottom: -15px;
  left: 15px;
  z-index: 1;
  color: white;
}

.col a .hover:after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  background: rgb(130, 146, 236);
  opacity: 0;
  transition: 0.35s ease;
}

.col a .hover:hover:after {
  opacity: 0.85;
  transition: 0.35s ease;
}

.align-bottom {
  position: absolute;
  width: 100%;
  bottom: 0%;
  z-index: 2;
  padding: 15px 20px;
}

.bg-img {
  padding: 0px;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-size: cover;
  background-position: 50% 50%;
}

@media only screen and (max-width: 1200px) {
  .layer .col {
    width: 16%;
  }
}

@media only screen and (max-width: 650px) {
  .layer .col {
    width: 25%;
  }
}
</style>
