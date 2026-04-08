<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const navLinks = document.querySelectorAll("#nav a")
  const slide1 = document.querySelector(".slide1")
  const slide2 = document.querySelector(".slide2")

  // Set initial position
  const currentWidth = document.querySelector("#nav li:nth-of-type(3) a").parent("li").width()
  const current = document.querySelector("li:nth-of-type(3) a").position()
  if (slide1 && current) {
    slide1.style.opacity = '1'
    slide1.style.left = current.left + 'px'
    slide1.style.width = currentWidth + 'px'
  }

  navLinks.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault()
      const position = this.parentElement.position()
      const width = this.parentElement.width()
      if (slide1) {
        slide1.style.opacity = '1'
        slide1.style.left = position.left + 'px'
        slide1.style.width = width + 'px'
      }
    })

    link.addEventListener("mouseover", function () {
      const position = this.parentElement.position()
      const width = this.parentElement.width()
      if (slide2) {
        slide2.style.opacity = '1'
        slide2.style.left = position.left + 'px'
        slide2.style.width = width + 'px'
        slide2.classList.add("squeeze")
      }
    })

    link.addEventListener("mouseout", function () {
      if (slide2) {
        slide2.style.opacity = '0'
        slide2.classList.remove("squeeze")
      }
    })
  })
})
</script>

<template>
  <div class="demo-wrapper">
    <ul id="nav">
      <li class="slide1"></li>
      <li class="slide2"></li>
      <li><a href="#">Alpha</a></li>
      <li><a href="#">Beta</a></li>
      <li><a href="#">Gamma</a></li>
      <li><a href="#">Delta</a></li>
      <li><a href="#">Epsilon</a></li>
    </ul>
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
  background: url(./bg.jpg) no-repeat center center fixed;
  background-size: cover;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

#nav {
  position: relative;
  border: none;
  border-radius: 10em;
  display: flex;
  list-style: none;
  background: #f5f5f5;
  box-shadow: 20px 40px 40px #00000033;
  padding: 10px;
}

#nav li a {
  position: relative;
  padding: 15px 50px;
  font: 500 24px '优设标题黑';
  border: none;
  outline: none;
  color: rgb(70, 100, 180);
  display: inline-block;
  text-decoration: none;
  z-index: 3;
}

.slide1,
.slide2 {
  position: absolute;
  display: inline-block;
  height: 60px;
  border-radius: 10em;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1.05);
}

.slide1 {
  background-color: rgb(170, 190, 255);
  z-index: 2;
}

.slide2 {
  opacity: 0;
  background-color: rgba(170, 190, 255, .5);
  z-index: 1;
  box-shadow: 0 0 20px #ffffffaa inset;
}

.squeeze {
  transform: scale(0.9);
}
</style>
