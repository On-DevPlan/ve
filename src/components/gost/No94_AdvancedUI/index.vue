<script setup>
import { ref, onMounted } from 'vue'

const rootRef = ref(null)
const showPassword = ref(false)

onMounted(() => {
  const eye = document.querySelector('#eyeball')
  const beam = document.querySelector('#beam')
  const passwordInput = document.querySelector('#password')

  // Mouse move listener
  const mouseMoveHandler = (e) => {
    let rect = beam.getBoundingClientRect()
    let mouseX = rect.right + (rect.width / 2)
    let mouseY = rect.top + (rect.height / 2)
    let rad = Math.atan2(mouseX - e.pageX, mouseY - e.pageY)
    let degrees = (rad * (20 / Math.PI) * -1) - 350
    if (rootRef.value) {
      rootRef.value.style.setProperty('--beamDegrees', `${degrees}deg`)
    }
  }

  // Eye click handler
  const eyeClickHandler = (e) => {
    e.preventDefault()
    showPassword.value = !showPassword.value
    document.body.classList.toggle('show-password')
    if (passwordInput) {
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password'
      passwordInput.focus()
    }
  }

  if (rootRef.value) {
    rootRef.value.addEventListener('mousemove', mouseMoveHandler)
  }
  if (eye) {
    eye.addEventListener('click', eyeClickHandler)
  }

  // Cleanup
  return () => {
    if (rootRef.value) {
      rootRef.value.removeEventListener('mousemove', mouseMoveHandler)
    }
    if (eye) {
      eye.removeEventListener('click', eyeClickHandler)
    }
  }
})
</script>

<template>
  <div ref="rootRef" class="demo-wrapper">
    <div class="shell">
      <form>
        <h2>LOGIN</h2>
        <div class="form-item">
          <label for="username">Username</label>
          <div class="input-wrapper">
            <input type="text" id="username" autocomplete="off" autocorrect="off" autocapitalize="off"
              spellcheck="false" data-lpignore="true" />
          </div>
        </div>
        <div class="form-item">
          <label for="password">Password</label>
          <div class="input-wrapper">
            <input :type="showPassword ? 'text' : 'password'" id="password" autocomplete="off" autocorrect="off"
              autocapitalize="off" spellcheck="false" data-lpignore="true" />
            <button type="button" id="eyeball">
              <div class="eye"></div>
            </button>
            <div id="beam"></div>
          </div>
        </div>
        <button id="submit">Sign in</button>
      </form>
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
  align-items: center;
  justify-content: center;
  background: white;
}

.shell {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url(./img/1.png);
  background-size: cover;
}

* {
  box-sizing: border-box;
  transition: .2s;
}

:root {
  --bgColor: white;
  --inputColor: black;
  --outlineColor: rgb(60, 115, 235);
  --border: black;
}

body.show-password {
  --bgColor: rgba(0, 0, 0, 0.9);
  --inputColor: white;
  --border: rgb(255, 255, 255);
}

form {
  transform: translate3d(0, 0, 0);
  padding: 50px;
  border: 20px solid var(--border);
  border-radius: 10px;
  box-shadow: 10px 10px 10px #00000065;
}

form > * + * {
  margin-top: 15px;
}

.form-item > * + * {
  margin-top: 0.5rem;
}

h2,
label,
input,
button {
  font-size: 2rem;
  color: var(--inputColor);
  font-family: '优设标题黑';
}

h2 {
  font-size: 4rem;
  margin: 0;
}

label:focus,
input:focus,
button:focus {
  outline-offset: 2px;
}

label::-moz-focus-inner,
input::-moz-focus-inner,
button::-moz-focus-inner {
  border: none;
}

label[id=password],
input[id=password],
button[id=password] {
  color: black;
}

button {
  border: none;
}

[id=submit] {
  width: 100%;
  cursor: pointer;
  margin: 20px 0 0 2px;
  padding: 0.75rem 1.25rem;
  color: var(--bgColor);
  background-color: var(--inputColor);
  box-shadow: 4px 4px 0 rgba(30, 144, 255, 0.2);
}

[id=submit]:active {
  transform: translateY(1px);
}

.input-wrapper {
  position: relative;
}

input {
  padding: 0.75rem 4rem 0.75rem 0.75rem;
  width: 100%;
  border: 2px solid transparent;
  border-radius: 0;
  background-color: transparent;
  box-shadow: inset 0 0 0 2px black, inset 6px 6px 0 rgba(30, 144, 255, 0.2), 3px 3px 0 rgba(30, 144, 255, 0.2);
  -webkit-appearance: none;
}

input:focus {
  outline-offset: 1px;
}

.show-password input {
  box-shadow: inset 0 0 0 2px black;
  border: 2px dashed white;
}

.show-password input:focus {
  outline: none;
  border-color: rgb(255, 255, 145);
}

[id=eyeball] {
  --size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  position: absolute;
  top: 50%;
  right: 0.75rem;
  border: none;
  background-color: transparent;
  transform: translateY(-50%);
}

[id=eyeball]:active {
  transform: translateY(calc(-50% + 1px));
}

.eye {
  width: var(--size);
  height: var(--size);
  border: 2px solid var(--inputColor);
  border-radius: calc(var(--size) / 1.5) 0;
  transform: rotate(45deg);
}

.eye:before,
.eye:after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  border-radius: 100%;
}

.eye:before {
  width: 35%;
  height: 35%;
  background-color: var(--inputColor);
}

.eye:after {
  width: 65%;
  height: 65%;
  border: 2px solid var(--inputColor);
  border-radius: 100%;
}

[id=beam] {
  position: absolute;
  top: 50%;
  right: 1.75rem;
  clip-path: polygon(100% 50%, 100% 50%, 0 0, 0 100%);
  width: 100vw;
  height: 25vw;
  z-index: 1;
  mix-blend-mode: multiply;
  transition: transform 200ms ease-out;
  transform-origin: 100% 50%;
  transform: translateY(-50%) rotate(var(--beamDegrees, 0));
  pointer-events: none;
}

.show-password [id=beam] {
  background: rgb(255, 255, 145);
}
</style>
