<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdn.staticfile.org/font-awesome/4.7.0/css/font-awesome.css'
  document.head.appendChild(link)
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <input type="text" placeholder="Search">
      <a href="#">
        <i class="fa fa-hand-o-right"></i>
        <i class="fa fa-search"></i>
      </a>
    </div>
  </div>
</template>

<style scoped>
@import url('https://cdn.staticfile.org/font-awesome/4.7.0/css/font-awesome.css');

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #ffdcdc;
}

.shell {
  position: relative;
  width: 1000px;
  padding: 33px;
  background-color: #ff7575;
  border-radius: 20px;
  box-shadow: 0 10px 50px #ff7575, 0 0 0 20px #fff;
}

.shell input {
  width: 80%;
  height: 100px;
  color: #fff;
  font: 300 80px '优设标题黑';
  border: 0;
  background-color: transparent;
  outline: none;
}

.shell input::placeholder {
  color: #8f36367e;
}

.shell a {
  display: flex;
  font-size: 120px;
  position: absolute;
  right: 60px;
  top: 10px;
  color: #fff;
  width: 250px;
  height: 150px;
  text-decoration: none;
}

.shell a .fa {
  margin: 10px 28px;
  transition: .3s;
}

.shell a .fa-search {
  transform: translateX(-80px);
  opacity: 1;
}

.shell a .fa-hand-o-right {
  transform: translateX(-100px);
  opacity: 0;
}

.shell a:hover .fa-search {
  transform: translateX(0);
  opacity: 0;
}

.shell a:hover .fa-hand-o-right {
  transform: translateX(110px);
  opacity: 1;
}

.shell a::before {
  content: 'GO!';
  position: absolute;
  display: block;
  font-size: 50px;
  background-color: #ff7575;
  padding: 5px 30px;
  top: 50px;
  right: -25px;
  border-radius: 10px;
  transition: .3s;
  opacity: 0;
  animation: box 1s infinite ease;
}

.shell a:hover::before {
  top: -115px;
  opacity: 1;
}

@keyframes box {
  0% { transform: rotate(0deg); }
  33% { transform: rotate(8deg); }
  66% { transform: rotate(-8deg); }
  100% { transform: rotate(0deg); }
}
</style>
