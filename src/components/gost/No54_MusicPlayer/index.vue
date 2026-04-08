<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const musicRef = ref(null)
const playBtnRef = ref(null)
const seekbarRef = ref(null)
const currentTimeRef = ref(null)
const durationRef = ref(null)
const favIconRef = ref(null)
const repIconRef = ref(null)
const volIconRef = ref(null)
const volBoxRef = ref(null)
const volumeRangeRef = ref(null)
const volumeDownRef = ref(null)
const volumeUpRef = ref(null)

let music = null
let playBtn = null
let seekbar = null
let currentTimeEl = null
let durationEl = null
let favIcon = null
let repIcon = null
let volIcon = null
let volBox = null
let volumeRange = null
let volumeDown = null
let volumeUp = null

const handlePlay = () => {
  if (music.paused) {
    music.play()
    playBtn.className = 'pause'
    playBtn.innerHTML = '<i class="material-icons">pause</i>'
  } else {
    music.pause()
    playBtn.className = 'play'
    playBtn.innerHTML = '<i class="material-icons">play_arrow</i>'
  }
  music.addEventListener('ended', function () {
    playBtn.className = 'play'
    playBtn.innerHTML = '<i class="material-icons">play_arrow</i>'
    music.currentTime = 0
  })
}

const handleSeekBar = () => {
  music.currentTime = seekbar.value
}

const handleFavorite = () => {
  favIcon.classList.toggle('active')
}

const handleRepeat = () => {
  if (music.loop == true) {
    music.loop = false
    repIcon.classList.toggle('active')
  } else {
    music.loop = true
    repIcon.classList.toggle('active')
  }
}

const handleVolume = () => {
  volIcon.classList.toggle('active')
  volBox.classList.toggle('active')
}

const handleVolumeDown = () => {
  volumeRange.value = Number(volumeRange.value) - 20
  music.volume = volumeRange.value / 100
}

const handleVolumeUp = () => {
  volumeRange.value = Number(volumeRange.value) + 20
  music.volume = volumeRange.value / 100
}

onMounted(() => {
  music = document.querySelector('.music-element')
  playBtn = document.querySelector('.play')
  seekbar = document.querySelector('.seekbar')
  currentTimeEl = document.querySelector('.current-time')
  durationEl = document.querySelector('.duration')
  favIcon = document.querySelector('.favorite')
  repIcon = document.querySelector('.repeat')
  volIcon = document.querySelector('.volume')
  volBox = document.querySelector('.volume-box')
  volumeRange = document.querySelector('.volume-range')
  volumeDown = document.querySelector('.volume-down')
  volumeUp = document.querySelector('.volume-up')

  musicRef.value = music
  playBtnRef.value = playBtn
  seekbarRef.value = seekbar
  currentTimeRef.value = currentTimeEl
  durationRef.value = durationEl
  favIconRef.value = favIcon
  repIconRef.value = repIcon
  volIconRef.value = volIcon
  volBoxRef.value = volBox
  volumeRangeRef.value = volumeRange
  volumeDownRef.value = volumeDown
  volumeUpRef.value = volumeUp

  music.onloadeddata = function () {
    seekbar.max = music.duration
    var ds = parseInt(music.duration % 60)
    var dm = parseInt((music.duration / 60) % 60)
    durationEl.innerHTML = dm + ':' + ds
  }

  music.ontimeupdate = function () {
    seekbar.value = music.currentTime
  }

  music.addEventListener('timeupdate', function () {
    var cs = parseInt(music.currentTime % 60)
    var cm = parseInt((music.currentTime / 60) % 60)
    currentTimeEl.innerHTML = cm + ':' + cs
  }, false)

  volumeDown.addEventListener('click', handleVolumeDown)
  volumeUp.addEventListener('click', handleVolumeUp)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="cover">
        <img src="/gost/No54_MusicPlayer/1.jpg" alt="">
      </div>
      <div class="info">
        <div class="title">只因你太美</div>
        <div class="singer">坤坤</div>
      </div>
      <div class="volume-box">
        <span class="volume-down"><i class="material-icons">remove</i></span>
        <input type="range" class="volume-range" step="1" value="80" min="0" max="100"
          @input="music.volume = $event.target.value / 100">
        <span class="volume-up"><i class="material-icons">add</i></span>
      </div>
      <div class="btn-box">
        <i class="material-icons repeat" @click="handleRepeat">repeat</i>
        <i class="material-icons favorite active" @click="handleFavorite">favorite</i>
        <i class="material-icons volume" @click="handleVolume">volume_up</i>
      </div>
      <div class="music-box">
        <input type="range" class="seekbar" step="1" value="0" min="0" max="100" @input="handleSeekBar">
        <audio class="music-element">
          <source src="/gost/No54_MusicPlayer/鸡你太美.m4a">
        </audio>
        <span class="current-time">0:0</span><span class="duration">0:0</span>
        <span class="play" @click="handlePlay">
          <i class="material-icons">play_arrow</i>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  padding: 0;
  margin: 0;
  font-family: "优设标题黑";
  -webkit-user-select: none;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #6e7cf5;
}

.shell {
  z-index: 99;
  width: 330px;
  height: 580px;
  border-radius: 15px;
  box-shadow: 0 10px 30px #00000085;
  border-top: 1px solid rgba(255, 255, 255, 0.9);
  border-left: 1px solid rgba(255, 255, 255, 0.9);
  background: linear-gradient(to right bottom,
    rgba(255, 255, 255, 0.6),
    rgba(255, 255, 255, 0.3),
    rgba(255, 255, 255, 0.2));
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.cover {
  width: 280px;
  height: 270px;
  overflow: hidden;
  position: absolute;
  top: 20px;
  border-radius: 5px;
  box-shadow: 0 5px 30px #7d70ecb7;
}

.cover img {
  width: 100%;
}

.shell input[type=range] {
  -webkit-appearance: none !important;
  margin: 0px;
  padding: 0px;
  background: rgb(255, 255, 255);
  height: 5px;
  width: 150px;
  outline: none;
  cursor: pointer;
  overflow: hidden;
  border-radius: 5px;
}

.shell input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none !important;
  background: #ff3677;
  height: 5px;
  width: 5px;
  border-radius: 50%;
  box-shadow: -100vw 0 0 100vw rgb(160, 200, 250);
}

.shell input[type=range]::-moz-range-thumb {
  background: #ff3677;
  height: 8px;
  width: 8px;
  border-radius: 100%;
}

.shell input[type=range]::-ms-thumb {
  -webkit-appearance: none !important;
  background: #ff3677;
  height: 8px;
  width: 8px;
  border-radius: 100%;
}

.info {
  position: absolute;
  top: 305px;
  text-align: center;
}

.info .title {
  font-size: 35px;
  color: rgb(40, 45, 100);
}

.info .singer {
  font-size: 20px;
  color: #6e7cf5;
}

.btn-box {
  position: absolute;
  top: 400px;
  width: 100%;
  display: flex;
  justify-content: center;
}

.btn-box i {
  font-size: 24px;
  color: rgb(40, 45, 100);
  margin: 0 30px;
  cursor: pointer;
}

.btn-box i.active {
  color: #ff3677;
}

.volume-box {
  display: none;
  position: absolute;
  top: 370px;
  z-index: 1;
  padding: 0 20px;
}

.volume-box .volume-down {
  position: absolute;
  left: -15px;
  cursor: pointer;
  color: rgb(40, 45, 100);
}

.volume-box .volume-up {
  position: absolute;
  right: -15px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: rgb(40, 45, 100);
}

.volume-box .volume-up::selection {
  background-color: unset;
}

.volume-box input[type=range] {
  height: 5px;
  width: 150px;
  margin: 0 0 15px 0;
}

.volume-box.active {
  display: block;
}

.music-box {
  position: absolute;
  top: 445px;
}

.music-box input[type=range] {
  height: 5px;
  width: 230px;
  margin: 0 0 10px 0;
}

.music-box input[type=range]::-webkit-slider-thumb {
  height: 5px;
  width: 7px;
}

.music-box .current-time {
  position: absolute;
  left: -35px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #252525;
}

.music-box .duration {
  position: absolute;
  right: -35px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: rgb(40, 45, 100);
}

.music-box .play,
.music-box .pause {
  position: absolute;
  left: 50%;
  top: 55px;
  transform: translateX(-50%);
  width: 50px;
  height: 50px;
  border-radius: 50px;
  background-color: rgb(160, 200, 250);
  cursor: pointer;
  transition: all 0.4s;
}

.music-box .play i,
.music-box .pause i {
  font-size: 36px;
  color: rgb(40, 45, 100);
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-48%, -50%);
}

.music-box .pause i {
  font-size: 32px;
  transform: translate(-50%, -50%);
}
</style>
