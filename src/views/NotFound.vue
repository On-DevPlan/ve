<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="not-found">
    <div class="content">
      <h1>404</h1>
      <h2>页面未找到</h2>
      <p>抱歉，您访问的页面不存在。</p>
      <button @click="goHome" class="home-btn">
        返回首页
      </button>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.content {
  text-align: center;
  color: #666;
}

h1 {
  font-size: 72px;
  color: #999;
  margin-bottom: 16px;
}

h2 {
  font-size: 24px;
  color: #666;
  margin-bottom: 16px;
}

p {
  font-size: 16px;
  margin-bottom: 32px;
}

.home-btn {
  padding: 12px 32px;
  background: #888;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.home-btn:hover {
  background: #666;
}
</style>