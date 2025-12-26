<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  point: {
    type: Object,
    default: null
  },
  show: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create' // 'create' | 'edit' | 'view' | 'route'
  }
})

const emit = defineEmits(['close', 'save'])

// 表单数据
const formData = ref({
  title: '',
  description: '',
  images: []
})

// 计算对话框标题
const dialogTitle = computed(() => {
  if (props.mode === 'view') return '📍 查看记录'
  if (props.mode === 'route') return '🛣️ 编辑路线'
  if (props.point) return '✏️ 编辑记录'
  return '📍 新建记录'
})

// 是否为只读模式
const isReadOnly = computed(() => props.mode === 'view')

// 监听 point 变化
watch(() => props.point, (newPoint) => {
  if (newPoint) {
    formData.value = {
      title: newPoint.title || '',
      description: newPoint.description || '',
      images: newPoint.images || []
    }
  } else {
    formData.value = {
      title: '',
      description: '',
      images: []
    }
  }
}, { immediate: true })

// 处理图片上传
const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      formData.value.images.push(e.target.result)
    }
    reader.readAsDataURL(file)
  }
}

// 删除图片
const removeImage = (index) => {
  formData.value.images.splice(index, 1)
}

// 保存
const handleSave = () => {
  emit('save', { ...formData.value })
}

// 关闭
const handleClose = () => {
  if (isReadOnly.value) {
    emit('close')
  } else {
    emit('close')
  }
}
</script>

<template>
  <div v-if="show" class="editor-overlay" @click.self="handleClose">
    <div class="editor-dialog">
      <div class="editor-header">
        <h3>{{ dialogTitle }}</h3>
        <button @click="handleClose" class="close-btn">✕</button>
      </div>

      <div class="editor-body">
        <!-- 位置信息（只读模式显示） -->
        <div v-if="point && point.lon" class="location-info">
          <span class="location-label">📍 位置</span>
          <span class="location-coords">{{ point.lat?.toFixed(4) }}, {{ point.lon?.toFixed(4) }}</span>
          <span v-if="point.time" class="location-time">{{ point.time }}</span>
        </div>

        <div class="form-group">
          <label>{{ isReadOnly ? '标题' : '标题' }}</label>
          <input
            v-model="formData.title"
            type="text"
            placeholder="给这个地点起个名字..."
            class="form-input"
            :readonly="isReadOnly"
          />
        </div>

        <div class="form-group">
          <label>描述</label>
          <textarea
            v-model="formData.description"
            placeholder="记录下这里的故事..."
            class="form-textarea"
            rows="4"
            :readonly="isReadOnly"
          ></textarea>
        </div>

        <div class="form-group" v-if="!isReadOnly">
          <label>图片</label>
          <div class="image-upload">
            <label class="upload-btn">
              <span>📷 添加图片</span>
              <input
                type="file"
                accept="image/*"
                @change="handleImageUpload"
                multiple
                style="display: none"
              />
            </label>
          </div>

          <div v-if="formData.images.length > 0" class="image-list">
            <div
              v-for="(img, index) in formData.images"
              :key="index"
              class="image-item"
            >
              <img :src="img" alt="上传的图片" />
              <button @click="removeImage(index)" class="remove-image">✕</button>
            </div>
          </div>
        </div>

        <!-- 只读模式显示图片 -->
        <div v-if="isReadOnly && formData.images.length > 0" class="form-group">
          <label>图片</label>
          <div class="image-list">
            <div
              v-for="(img, index) in formData.images"
              :key="index"
              class="image-item"
            >
              <img :src="img" alt="图片" />
            </div>
          </div>
        </div>
      </div>

      <div class="editor-footer">
        <button @click="handleClose" class="btn-cancel">
          {{ isReadOnly ? '关闭' : '取消' }}
        </button>
        <button v-if="!isReadOnly" @click="handleSave" class="btn-save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.editor-dialog {
  background: #fff;
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(236, 72, 153, 0.3);
}

.editor-header {
  background: linear-gradient(135deg, #f472b6, #ec4899);
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-header h3 {
  margin: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.editor-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.location-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fdf2f8;
  border-radius: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.location-label {
  color: #ec4899;
  font-weight: 600;
  font-size: 14px;
}

.location-coords {
  color: #6b7280;
  font-size: 13px;
  font-family: monospace;
}

.location-time {
  color: #9ca3af;
  font-size: 12px;
  margin-left: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  color: #ec4899;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #fce7f3;
  border-radius: 12px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #ec4899;
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #fbcfe8;
}

.image-upload {
  margin-bottom: 12px;
}

.upload-btn {
  display: inline-block;
  padding: 12px 20px;
  background: #fce7f3;
  color: #ec4899;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.upload-btn:hover {
  background: #fbcfe8;
  transform: translateY(-2px);
}

.image-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(236, 72, 153, 0.9);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image:hover {
  background: #db2777;
}

.editor-footer {
  padding: 16px 20px;
  border-top: 1px solid #fce7f3;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f3f4f6;
  color: #6b7280;
  border: none;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-save {
  background: linear-gradient(135deg, #f472b6, #ec4899);
  color: #fff;
  border: none;
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
}
</style>
