<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const shellRef = ref(null)
let activeIndex = 0

const timelineItems = [
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/01.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/02.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/03.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/04.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/05.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/06.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/07.jpg' },
  { year: '2002', desc: '如果你停止，就是谷底。如果你还在继续，就是上坡。这是我听过关于人生低谷最好的阐述。', img: '/gost/No62_ResponsiveTimeline/img/08.jpg' },
]

const handleScroll = () => {
  if (!shellRef.value) return
  const items = shellRef.value.querySelectorAll('.item')
  const itemLength = items.length
  const scrollTop = window.scrollY

  items.forEach((item, i) => {
    const offsetTop = item.offsetTop
    const height = item.offsetHeight
    const mid = offsetTop + height / 2

    if (i === itemLength - 2 && scrollTop > offsetTop + height / 2) {
      // Last item
      activeIndex = itemLength - 1
    } else if (scrollTop >= offsetTop - window.innerHeight / 2 && scrollTop < offsetTop + height - 50) {
      activeIndex = i
    }
  })

  // Update active class
  items.forEach((item, i) => {
    if (i === activeIndex) {
      item.classList.add('item--active')
    } else {
      item.classList.remove('item--active')
    }
  })

  // Update background
  if (shellRef.value) {
    const activeItem = items[activeIndex]
    if (activeItem) {
      const img = activeItem.querySelector('.img')
      if (img) {
        shellRef.value.style.backgroundImage = `url(${img.src})`
      }
    }
  }
}

onMounted(() => {
  // Set initial state
  if (shellRef.value) {
    const firstImg = shellRef.value.querySelector('.item:first-child .img')
    if (firstImg) {
      shellRef.value.style.backgroundImage = `url(${firstImg.src})`
    }
  }
  handleScroll()
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="shell" ref="shellRef" id="shell">
    <div class="header">
      <h2 class="title">山羊の前端小窝</h2>
      <h3 class="subtitle">BILIBILI</h3>
    </div>
    <div class="timeline">
      <div
        class="item"
        v-for="(item, i) in timelineItems"
        :key="i"
        :data-text="'《你的孤独，虽败犹荣》'"
      >
        <div class="content">
          <img :src="item.img" alt="" class="img">
          <h2 class="content-title">{{ item.year }}</h2>
          <p class="content-desc">{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
}

.shell {
  width: 100%;
  position: relative;
  padding: 80px 0;
  transition: 0.3s ease 0s;
  background-attachment: fixed;
  background-size: cover;
}

.shell:before {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(99, 99, 99, 0.8);
  content: "";
}

.header {
  width: 100%;
  text-align: center;
  margin-bottom: 80px;
  position: relative;
}

.title {
  color: #fff;
  font-size: 46px;
  font-weight: normal;
  margin: 0;
}

.timeline {
  display: flex;
  margin: 0 auto;
  flex-wrap: wrap;
  flex-direction: column;
  max-width: 700px;
  position: relative;
}

.content-title {
  font-weight: normal;
  font-size: 66px;
  margin: -10px 0 0 0;
  transition: 0.4s;
  padding: 0 10px;
  box-sizing: border-box;
  color: #fff;
}

.content-desc {
  margin: 0;
  font-size: 15px;
  box-sizing: border-box;
  color: rgba(255, 255, 255, 0.7);
  line-height: 25px;
}

.timeline:before {
  position: absolute;
  left: 50%;
  width: 2px;
  height: 100%;
  margin-left: -1px;
  content: "";
  background: rgba(255, 255, 255, 0.07);
}

.item {
  padding: 40px 0;
  opacity: 0.3;
  filter: blur(2px);
  transition: 0.5s;
  box-sizing: border-box;
  width: calc(50% - 40px);
  display: flex;
  position: relative;
  transform: translateY(-80px);
}

.item:before {
  content: attr(data-text);
  letter-spacing: 3px;
  width: 100%;
  position: absolute;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  border-left: 2px solid rgba(255, 255, 255, 0.5);
  top: 70%;
  margin-top: -5px;
  padding-left: 15px;
  opacity: 0;
  right: calc(-100% - 56px);
  font: 900 20px '';
  letter-spacing: 5px;
}

.item:nth-child(even) {
  align-self: flex-end;
}

.item:nth-child(even):before {
  right: auto;
  text-align: right;
  left: calc(-100% - 56px);
  padding-left: 0;
  border-left: none;
  border-right: 2px solid rgba(255, 255, 255, 0.5);
  padding-right: 15px;
}

.item--active {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0px);
}

.item--active:before {
  top: 50%;
  transition: 0.3s all 0.2s;
  opacity: 1;
}

.item--active .content-title {
  margin: -50px 0 20px 0;
}

.img {
  max-width: 100%;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.4);
}

.subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  letter-spacing: 5px;
  margin: 10px 0 0 0;
  font-weight: normal;
}

.footer {
  padding: 95px 0;
  text-align: center;
}

.footer a {
  color: #999;
  display: inline-block;
}

@media only screen and (max-width: 767px) {
  .item {
    align-self: baseline !important;
    width: 100%;
    padding: 0 30px 150px 80px;
  }

  .item:before {
    left: 10px !important;
    padding: 0 !important;
    top: 50px;
    text-align: center !important;
    width: 60px;
    border: none !important;
  }

  .item:last-child {
    padding-bottom: 40px;
  }
}

@media only screen and (max-width: 767px) {
  .timeline:before {
    left: 40px;
  }
}
</style>
