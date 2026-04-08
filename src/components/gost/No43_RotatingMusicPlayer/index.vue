<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isBg = ref(false)

onMounted(() => {
  // Use event delegation on the demo-wrapper
  const wrapper = document.querySelector('.demo-wrapper')
  if (wrapper) {
    wrapper.addEventListener('change', (e) => {
      if (e.target && e.target.type === 'radio') {
        isBg.value = !isBg.value
      }
    })
  }
})
</script>

<template>
  <div class="demo-wrapper" :class="{ background: isBg }">
    <div class="shell">
      <input type="radio" name="music" id="item-1" checked>
      <input type="radio" name="music" id="item-2">
      <input type="radio" name="music" id="item-3">
      <div class="cards">
        <label class="card" for="item-1" id="song-1">
          <img src="/gost/No43_RotatingMusicPlayer/1.jpg" alt="">
        </label>
        <label class="card" for="item-2" id="song-2">
          <img src="/gost/No43_RotatingMusicPlayer/2.jpg" alt="">
        </label>
        <label class="card" for="item-3" id="song-3">
          <img src="/gost/No43_RotatingMusicPlayer/3.jpg" alt="">
        </label>
      </div>
      <div class="player">
        <div class="information">
          <div>
            <img src="/gost/No43_RotatingMusicPlayer/play.png" style="width:40px;margin-top: 5px;" alt="">
          </div>
          <div class="info-area" id="test">
            <label class="song-info" id="song-info-1">
              <div class="title">How You Like That</div>
              <div class="Subheading">
                <div class="singer">BLACKPINK</div>
                <div class="time">3:01</div>
              </div>
            </label>
            <label class="song-info" id="song-info-2">
              <div class="title">DDU-DU DDU-DU</div>
              <div class="Subheading">
                <div class="singer">BLACKPINK</div>
                <div class="time">3:29</div>
              </div>
            </label>
            <label class="song-info" id="song-info-3">
              <div class="title">Kill This Love</div>
              <div class="Subheading">
                <div class="singer">BLACKPINK</div>
                <div class="time">3:09</div>
              </div>
            </label>
          </div>
        </div>
        <div class="progress-bar">
          <span class="progress"></span>
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
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(120deg, #9795f0 0%, #fbc8d4 100%);
  transition: background-image 0.4s ease;
}

.demo-wrapper.background {
  background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

input[type=radio] {
  display: none;
}

.card {
  position: absolute;
  width: 60%;
  height: 100%;
  left: 0;
  right: 0;
  margin: auto;
  transition: transform 0.4s ease;
  cursor: pointer;
}

.shell {
  width: 100%;
  max-width: 800px;
  max-height: 550px;
  height: 100%;
  transform-style: preserve-3d;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
}

.cards {
  position: relative;
  width: 100%;
  height: 100%;
  margin-bottom: 20px;
}

.cards img {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
}

#item-1:checked ~ .cards #song-1,
#item-2:checked ~ .cards #song-2,
#item-3:checked ~ .cards #song-3 {
  transform: translatex(0) scale(1);
  opacity: 1;
  z-index: 1;
}

#item-1:checked ~ .cards #song-2,
#item-2:checked ~ .cards #song-3,
#item-3:checked ~ .cards #song-1 {
  transform: translatex(50%) scale(0.8);
  opacity: 0.6;
  z-index: 0;
}

#item-1:checked ~ .cards #song-3,
#item-2:checked ~ .cards #song-1,
#item-3:checked ~ .cards #song-2 {
  transform: translatex(-50%) scale(0.8);
  opacity: 0.6;
  z-index: 0;
}

.player {
  background-color: #fff;
  border-radius: 8px;
  width: 520px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0px 2px 10px rgba(40, 40, 40, 0.5);
}

.title {
  font: 700 17px '';
}

.information {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  height: 42px;
  overflow: hidden;
}

.info-area {
  width: 100%;
  position: absolute;
  top: 0;
  left: 50px;
  transition: transform 0.4s ease-in;
}

.song-info {
  width: calc(100% - 50px);
  display: block;
}

.Subheading {
  display: flex;
  color: #8f868f;
  font-size: 15px;
}

.time {
  margin-left: auto;
}

.progress-bar {
  height: 4px;
  width: 100%;
  background-color: #e9efff;
}

.progress {
  display: block;
  position: relative;
  width: 60%;
  height: 100%;
  background-color: #2992dc;
}

#item-2:checked ~ .player #test {
  transform: translateY(-42px);
}

#item-3:checked ~ .player #test {
  transform: translateY(-84px);
}
</style>
