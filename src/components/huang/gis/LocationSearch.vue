<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  // 是否显示搜索框
  show: {
    type: Boolean,
    default: true
  },
  // 占位符文本
  placeholder: {
    type: String,
    default: '搜索地点...'
  },
  // 最小输入长度
  minLength: {
    type: Number,
    default: 2
  }
})

const emit = defineEmits([
  'select'  // 选择地点时触发，参数: { name, address, lon, lat }
])

// 高德地图 API Key
const AMAP_KEY = '973b435c91011c1b33b8c633c6c9eb56'

// 搜索关键词
const keyword = ref('')
// 搜索结果
const searchResults = ref([])
// 是否正在搜索
const isLoading = ref(false)
// 是否显示结果列表
const showResults = ref(false)
// 错误信息
const errorMessage = ref('')

// 防抖定时器
let debounceTimer = null

// 搜索地点
const searchPlace = async () => {
  const query = keyword.value.trim()

  if (query.length < props.minLength) {
    searchResults.value = []
    showResults.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(query)}&types=&city=&children=1&offset=20&page=1&extensions=base`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === '1' && data.pois && data.pois.length > 0) {
      searchResults.value = data.pois.map(poi => ({
        id: poi.id,
        name: poi.name,
        address: poi.address || poi.pname + poi.cityname + poi.adname,
        lon: parseFloat(poi.location.split(',')[0]),
        lat: parseFloat(poi.location.split(',')[1]),
        type: poi.type
      }))
      showResults.value = true
    } else {
      searchResults.value = []
      showResults.value = false
      errorMessage.value = '未找到相关地点'
    }
  } catch (error) {
    console.error('搜索失败:', error)
    errorMessage.value = '搜索失败，请稍后重试'
    searchResults.value = []
    showResults.value = false
  } finally {
    isLoading.value = false
  }
}

// 防抖搜索
watch(keyword, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    searchPlace()
  }, 500)
})

// 选择地点
const selectPlace = (place) => {
  emit('select', place)
  keyword.value = place.name
  showResults.value = false
}

// 清空搜索
const clearSearch = () => {
  keyword.value = ''
  searchResults.value = []
  showResults.value = false
  errorMessage.value = ''
}

// 聚焦时显示结果（如果有）
const handleFocus = () => {
  if (searchResults.value.length > 0) {
    showResults.value = true
  }
}

// 点击外部关闭结果列表
const handleClickOutside = () => {
  showResults.value = false
}
</script>

<template>
  <div class="location-search" v-if="show">
    <div class="search-input-wrapper">
      <input
        v-model="keyword"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        @focus="handleFocus"
        @blur="() => setTimeout(() => showResults = false, 200)"
      />
      <button
        v-if="keyword"
        @click="clearSearch"
        class="clear-btn"
        title="清空"
      >
        ✕
      </button>
      <div v-if="isLoading" class="search-loading">
        <span class="spinner"></span>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage && !isLoading" class="search-error">
      {{ errorMessage }}
    </div>

    <!-- 搜索结果列表 -->
    <Transition name="dropdown">
      <div v-if="showResults && searchResults.length > 0" class="search-results">
        <div
          v-for="place in searchResults"
          :key="place.id"
          class="result-item"
          @click="selectPlace(place)"
        >
          <div class="result-name">{{ place.name }}</div>
          <div class="result-address">
            <span class="address-icon">📍</span>
            {{ place.address }}
          </div>
          <div v-if="place.type" class="result-type">{{ place.type }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.location-search {
  position: relative;
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 12px 40px 12px 16px;
  border: 2px solid #fce7f3;
  border-radius: 12px;
  font-size: 14px;
  color: #374151;
  background: #fff;
  transition: all 0.2s;
  outline: none;
}

.search-input:focus {
  border-color: #ec4899;
  box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-btn {
  position: absolute;
  right: 12px;
  width: 24px;
  height: 24px;
  border: none;
  background: #f3f4f6;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.search-loading {
  position: absolute;
  right: 40px;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #fce7f3;
  border-top-color: #ec4899;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-error {
  margin-top: 8px;
  padding: 10px 12px;
  background: #fef2f2;
  border-radius: 8px;
  font-size: 13px;
  color: #dc2626;
}

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-results::-webkit-scrollbar-thumb {
  background: #fbcfe8;
  border-radius: 3px;
}

.result-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.2s;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: #fdf2f8;
}

.result-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.result-address {
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.address-icon {
  font-size: 10px;
}

.result-type {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

/* Dropdown 动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
