<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  msg: {
    type: String,
    default: 'Hello World!'
  },
  showIcon: {
    type: Boolean,
    default: true
  },
  animated: {
    type: Boolean,
    default: false
  }
})

const count = ref(0)
const animatedClass = computed(() => props.animated ? 'animated' : '')
</script>

<template>
  <div class="hello-world">
    <div :class="['content', animatedClass]">
      <span v-if="showIcon" class="icon">👋</span>
      <h1>{{ msg }}</h1>
      <p>这是一个简单的Hello World组件演示</p>

      <div class="counter">
        <button @click="count--">-</button>
        <span>{{ count }}</span>
        <button @click="count++">+</button>
      </div>

      <div class="features">
        <h3>特性：</h3>
        <ul>
          <li>支持自定义消息</li>
          <li>可控制图标显示</li>
          <li>动画效果可选</li>
          <li>响应式设计</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hello-world {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px;
}

.content {
  text-align: center;
  max-width: 600px;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.animated {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.icon {
  font-size: 48px;
  display: block;
  margin-bottom: 20px;
}

h1 {
  color: #404040;
  font-size: 32px;
  margin-bottom: 16px;
}

p {
  color: #666;
  font-size: 16px;
  margin-bottom: 32px;
}

.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
}

.counter button {
  width: 36px;
  height: 36px;
  border: 1px solid #d0d0d0;
  background: #f8f8f8;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.counter button:hover {
  background: #e8e8e8;
}

.counter span {
  font-size: 24px;
  font-weight: 600;
  color: #404040;
  min-width: 40px;
}

.features {
  text-align: left;
  background: #f8f8f8;
  padding: 20px;
  border-radius: 8px;
}

.features h3 {
  color: #404040;
  margin-bottom: 12px;
}

.features ul {
  list-style: none;
  padding: 0;
}

.features li {
  padding: 8px 0;
  color: #666;
  position: relative;
  padding-left: 24px;
}

.features li:before {
  content: "✓";
  position: absolute;
  left: 0;
  color: #4caf50;
}
</style>