<script setup>
import { ref } from 'vue'

const isDark = ref(false)
const isClosed = ref(true)

function toggleSidebar() {
  isClosed.value = !isClosed.value
}

function toggleDark() {
  isDark.value = !isDark.value
}
</script>

<template>
  <div class="demo-wrapper" :class="{ dark: isDark }">
    <nav class="shell" :class="{ close: isClosed }">
      <header>
        <div class="image-text">
          <span class="image">
            <img src="/gost/No87_MultiFunctionNav/1.jpg" alt="" />
          </span>
          <div class="text logo-text">
            <span class="name">山羊の前端小窝</span>
            <span class="software">-bilibili-</span>
          </div>
        </div>
        <div class="toggle" @click="toggleSidebar">
          <span class="iconfont icon-xiangyoujiantou"></span>
        </div>
      </header>
      <div class="menu-bar">
        <div class="menu">
          <li class="search-box">
            <span class="iconfont icon-sousuo icon"></span>
            <input type="text" placeholder="搜索..." />
          </li>
          <ul class="menu-links">
            <li class="nav-link">
              <a href="#">
                <span class="iconfont icon-shouye icon"></span>
                <span class="text">主页</span>
              </a>
            </li>
            <li class="nav-link">
              <a href="#">
                <span class="iconfont icon-shoucangxiao icon"></span>
                <span class="text">我的收藏</span>
              </a>
            </li>
            <li class="nav-link">
              <a href="#">
                <span class="iconfont icon-lishi icon"></span>
                <span class="text">历史记录</span>
              </a>
            </li>
            <li class="nav-link">
              <a href="#">
                <span class="iconfont icon-xiaoxi icon"></span>
                <span class="text">消息</span>
              </a>
            </li>
            <li class="nav-link">
              <a href="#">
                <span class="iconfont icon-fensi icon"></span>
                <span class="text">粉丝管理</span>
              </a>
            </li>
            <li class="nav-link">
              <a href="#">
                <span class="iconfont icon-chuangzuo icon"></span>
                <span class="text">创作中心</span>
              </a>
            </li>
          </ul>
        </div>
        <div class="bottom-content">
          <li class="">
            <a href="#">
              <span class="iconfont icon-zhuxiaoyuan icon"></span>
              <span class="text">注销</span>
            </a>
          </li>
          <li class="mode" @click="toggleDark">
            <div class="sun-moon">
              <span class="iconfont icon-rijian icon sun"></span>
              <span class="iconfont icon-yejian icon moon"></span>
            </div>
            <span class="mode-text text">{{ isDark ? '白日模式' : '夜间模式' }}</span>
            <div class="toggle-switch">
              <span class="switch"></span>
            </div>
          </li>
        </div>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.demo-wrapper {
  min-height: 100vh;
  background-color: #e4e9f7;
  transition: all 0.3s ease;
}

.demo-wrapper.dark {
  --body-color: #202224;
  --shell-color: #171717;
  --primary-color: #3a3b3c;
  --primary-color-light: #3a3b3c;
  --toggle-color: #fff;
  --text-color: #ccc;
  background-color: #202224;
}

.demo-wrapper {
  --shell-color: #fff;
  --primary-color: #695cfe;
  --primary-color-light: #f6f5ff;
  --toggle-color: #ddd;
  --text-color: #707070;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.shell {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 250px;
  padding: 10px 14px;
  background: var(--shell-color);
  transition: all 0.3s ease;
  z-index: 100;
}

.shell.close {
  width: 88px;
}

.shell li {
  height: 50px;
  list-style: none;
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.image,
.icon {
  min-width: 60px;
  border-radius: 6px;
}

.icon {
  min-width: 60px;
  border-radius: 6px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23px;
  color: var(--text-color);
  transition: all 0.3s ease;
}

.text,
.icon {
  color: var(--text-color);
  transition: all 0.3s ease;
}

.text {
  font-size: 17px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 1;
}

.shell.close .text {
  opacity: 0;
}

header {
  position: relative;
}

.image-text {
  display: flex;
  align-items: center;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.name {
  margin-top: 2px;
  font-size: 18px;
  font-weight: 600;
}

.software {
  font-size: 20px;
  margin-top: -2px;
  display: block;
}

.image {
  display: flex;
  align-items: center;
  justify-content: center;
}

.image img {
  width: 45px;
  border-radius: 6px;
}

.toggle {
  position: absolute;
  top: 50%;
  right: -25px;
  transform: translateY(-50%) rotate(180deg);
  height: 25px;
  width: 25px;
  background-color: #695cfe;
  color: var(--shell-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.shell.close .toggle {
  transform: translateY(-50%) rotate(0deg);
}

.menu {
  margin-top: 40px;
}

li.search-box {
  border-radius: 6px;
  background-color: var(--primary-color-light);
  cursor: pointer;
  transition: all 0.3s ease;
  list-style: none;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

li.search-box input {
  height: 100%;
  width: 100%;
  outline: none;
  border: none;
  background-color: var(--primary-color-light);
  color: var(--text-color);
  border-radius: 6px;
  font-size: 17px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.shell li a {
  list-style: none;
  height: 50px;
  background-color: transparent;
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.3s ease;
}

.shell li a:hover {
  background-color: var(--primary-color);
}

.shell li a:hover .icon,
.shell li a:hover .text {
  color: var(--shell-color);
}

.menu-bar {
  height: calc(100% - 55px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: scroll;
}

.menu-bar::-webkit-scrollbar {
  display: none;
}

.menu-bar .mode {
  border-radius: 6px;
  background-color: var(--primary-color-light);
  position: relative;
  transition: all 0.3s ease;
  list-style: none;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding-left: 10px;
}

.menu-bar .mode .sun-moon {
  height: 50px;
  width: 60px;
  position: relative;
}

.mode .sun-moon .icon {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.mode .sun-moon .sun {
  opacity: 0;
}

.mode .sun-moon .moon {
  opacity: 1;
}

.demo-wrapper.dark .mode .sun-moon .sun {
  opacity: 1;
}

.demo-wrapper.dark .mode .sun-moon .moon {
  opacity: 0;
}

.toggle-switch {
  position: absolute;
  right: 0;
  height: 100%;
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
}

.switch {
  position: relative;
  height: 22px;
  width: 40px;
  border-radius: 25px;
  background-color: var(--toggle-color);
  transition: all 0.3s ease;
}

.switch::before {
  content: '';
  position: absolute;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  top: 50%;
  left: 5px;
  transform: translateY(-50%);
  background-color: var(--shell-color);
  transition: all 0.3s ease;
}

.demo-wrapper.dark .switch::before {
  left: 20px;
}

.mode-text {
  font-size: 17px;
  font-weight: 500;
  color: var(--text-color);
}

.iconfont {
  font-family: 'iconfont' !important;
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.icon-xiangyoujiantou:before { content: '\e6c7'; }
.icon-sousuo:before { content: '\e724'; }
.icon-shouye:before { content: '\e7a6'; }
.icon-shoucangxiao:before { content: '\e79a'; }
.icon-lishi:before { content: '\e7c0'; }
.icon-xiaoxi:before { content: '\e77a'; }
.icon-fensi:before { content: '\e6a5'; }
.icon-chuangzuo:before { content: '\e7b6'; }
.icon-zhuxiaoyuan:before { content: '\e7b7'; }
.icon-rijian:before { content: '\e7a3'; }
.icon-yejian:before { content: '\e7a4'; }
</style>
