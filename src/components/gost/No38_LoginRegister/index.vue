<script setup>
import { ref } from 'vue'

const isSignUp = ref(true)

function toggle() {
  isSignUp.value = !isSignUp.value
}
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="top">
        <span :class="{ off: !isSignUp, on: isSignUp }">SIGN IN</span>
        <div class="button" @click="toggle">
          <div class="ball" :class="{ right: !isSignUp }"></div>
        </div>
        <span :class="{ off: isSignUp, on: !isSignUp }">SIGN UP</span>
      </div>

      <div class="bottom" :class="{ flip: !isSignUp }">
        <div class="signIn">
          <h2>Sign in</h2>
          <input type="text" placeholder="Username">
          <input type="text" placeholder="Password">
          <button>GO</button>
        </div>
        <div class="signUp">
          <h2>Sign up</h2>
          <input type="text" placeholder="Username">
          <input type="text" placeholder="Password">
          <input type="text" placeholder="Confirm password">
          <button>GO</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  padding: 0;
  margin: 0;
  outline: none;
  border: none;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgb(31, 32, 41);
}

.shell {
  width: 300px;
  height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
  perspective: 1000px;
}

.top {
  width: 300px;
  display: flex;
  cursor: pointer;
  justify-content: space-evenly;
}

.off,
.on {
  color: #fff;
  transition: 0.5s;
  font: 300 20px '';
}
.on {
  opacity: 0.5;
}
.button {
  width: 60px;
  height: 25px;
  background-color: rgb(255, 235, 167);
  border-radius: 20px;
  position: relative;
}

.ball {
  position: absolute;
  width: 25px;
  height: 25px;
  background-color: rgb(46, 45, 56);
  border-radius: 50%;
  transition: 0.5s;
  box-shadow: 0 0 10px #000;
  left: 0;
  transform: translate(-1px);
}
.ball.right {
  left: 61%;
}

.bottom {
  width: 300px;
  height: 250px;
  background-image: url('/gost/No38_LoginRegister/background.png');
  transform-style: preserve-3d;
  position: relative;
  transition: 0.7s;
  border-radius: 5px;
}

.bottom > div {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
}

.bottom > div h2 {
  color: white;
}
.bottom > div input {
  width: 200px;
  height: 25px;
  padding: 0 10px;
  background-color: rgb(31, 32, 41);
  color: #fff;
}

.bottom > div button {
  width: 80px;
  height: 30px;
  color: #333;
  font-size: 15px;
  background-color: rgb(255, 235, 167);
  border-radius: 4px;
  transition: 0.3s;
  margin-bottom: 10px;
  cursor: pointer;
  box-shadow: 0 0 10px rgb(255, 235, 167);
}
.signIn {
  transform: translateZ(70px);
}

.signUp {
  position: absolute;
  top: 0;
  transform: translateZ(-70px) rotateY(180deg);
}

.bottom.flip {
  transform: rotateY(180deg);
}
</style>
