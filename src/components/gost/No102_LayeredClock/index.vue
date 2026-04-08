<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

let timeUpdateLoop = null

onMounted(() => {
  const c = new Clock7(".clock")
  return () => clearTimeout(timeUpdateLoop)
})

class Clock7 {
  constructor(el) {
    this.el = document.querySelector(el)
    this.init()
  }

  init() {
    this.timeUpdate()
  }

  get timeAsObject() {
    const date = new Date()
    let h = date.getHours()
    const m = date.getMinutes()
    const s = date.getSeconds()
    return { h, m, s }
  }

  get timeAsString() {
    const [h, m, s, ap] = this.timeDigitsGrouped
    return `${h}:${m}:${s} ${ap}M`
  }

  get timeDigitsGrouped() {
    let { h, m, s } = this.timeAsObject
    const ap = h > 11 ? "P" : "A"
    if (h === 0) h += 12
    else if (h > 12) h -= 12
    if (m < 10) m = `0${m}`
    if (s < 10) s = `0${s}`
    return [h, m, s, ap]
  }

  timeUpdate() {
    if (this.el) {
      this.el.setAttribute("aria-label", this.timeAsString)
    }
    const time = this.timeAsObject
    const secFraction = time.s / 60
    const minFraction = (time.m + secFraction) / 60
    const hrFraction = (time.h + minFraction) / 12

    if (this.el) {
      this.el.style.setProperty("--secAngle", `${360 * secFraction}deg`)
      this.el.style.setProperty("--minAngle", `${360 * minFraction}deg`)
      this.el.style.setProperty("--hrAngle", `${360 * hrFraction}deg`)
    }

    Array.from(document.querySelectorAll(`[data-unit]`)).forEach((unit, i) => {
      unit.innerText = this.timeDigitsGrouped[i]
    })

    clearTimeout(timeUpdateLoop)
    timeUpdateLoop = setTimeout(this.timeUpdate.bind(this), 1e3)
  }
}
</script>

<template>
  <div class="demo-wrapper">
    <div class="clock">
      <div class="layer layer--img"></div>
      <div class="layer layer--shade"></div>
      <div class="layer layer--face">
        <div class="digits">
          <span class="digit-group" data-unit="h">12</span>
          <span>:</span>
          <span class="digit-group" data-unit="m">00</span>
          <small class="digit-group digit-group--small" data-unit="s">00</small>
          <small class="digit-group digit-group--small" data-unit="ap">A</small>
        </div>
        <div class="hand hand--hr"></div>
        <div class="hand hand--min"></div>
        <div class="hand hand--sec"></div>
        <div class="ring"></div>
      </div>
      <div class="layer layer--profile">
        <img src="/gost/No102_LayeredClock/04.jpg" alt="" class="profile">
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
  background-color: hsl(223, 90%, 40%);
  color: hsl(0, 0%, 100%);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.clock {
  --hrAngle: 0;
  --minAngle: 0;
  --secAngle: 0;
  border-radius: 50%;
  margin: auto;
  outline: transparent;
  position: relative;
  width: 12em;
  height: 12em;
  transform: rotateX(30deg) rotateY(-30deg) rotateZ(30deg);
  transform-style: preserve-3d;
  transition: transform 0.3s cubic-bezier(0.42, 0, 0.58, 1);
}

.clock:focus-visible,
.clock:hover {
  transform: rotateX(0) rotateY(0) rotateZ(0);
}

.profile {
  background-color: hsl(223, 10%, 50%);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 0.25em hsla(223, 90%, 10%, 0.6);
  display: block;
  margin: 7.75em auto 0 auto;
  width: 2em;
  height: 2em;
}

.digits {
  display: flex;
  justify-content: center;
  align-items: end;
  line-height: 1;
  margin-top: 2.25em;
  user-select: none;
}

.digit-group {
  margin: 0 0.1em;
  width: 2ch;
}

.digit-group[data-unit="h"] {
  text-align: right;
}

.digit-group--small {
  font-size: 0.75em;
}

.hand,
.layer,
.ring {
  position: absolute;
}

.hand {
  bottom: calc(50% - 0.5em);
  left: calc(50% - 0.5em);
  width: 1em;
  mix-blend-mode: difference;
  perspective: 4.25em;
  transform-origin: 0.5em calc(100% - 0.5em);
  transition: .5s;
}

.hand--hr {
  height: 2.75em;
  transform: rotate(var(--hrAngle)) translateY(-2em);
}

.hand--min {
  height: 3.75em;
  transform: rotate(var(--minAngle)) translateY(-2em);
}

.hand--sec {
  width: .5em;
  height: 3.75em;
  transform: rotate(var(--secAngle)) translateY(-2em);
}

.hand:before {
  background-color: hsl(0, 0%, 100%);
  content: "";
  display: block;
  width: 100%;
  height: 100%;
  transform: rotateX(-30deg);
  transform-origin: 50% 100%;
}

.hand--hr:before {
  border-radius: 0.5em 0.5em 0.5em 0.5em / 0.5em 0.5em 0.75em 0.75em;
}

.hand--min:before {
  border-radius: 0 0 0.5em 0.5em / 0 0 0.75em 0.75em;
}

.hand--sec:before {
  border-radius: 0 0 0.25em 0.25em / 0 0 0.5em 0.5em;
}

.layer,
.ring {
  border-radius: 50%;
  inset: 0;
}

.layer--face {
  transform: translateZ(3.75em);
}

.layer--img {
  background: url("/gost/No102_LayeredClock/05.jpg") 0 0 / 100% 100%;
  transform: translateZ(-3.75em);
}

.layer--profile {
  transform: translateZ(11em);
}

.layer--shade {
  background-color: hsla(223, 90%, 10%, 0.6);
}

.ring {
  box-shadow: 0 0 0 0.625em hsl(0, 0%, 100%) inset;
}
</style>
