<script setup>
import { ref } from 'vue'

const props = defineProps({
  endpoint: { type: String, required: true },
  apiKey: { type: String, required: true },
  model: { type: String, required: true }
})

const emit = defineEmits(['save', 'cancel'])

const localEndpoint = ref(props.endpoint)
const localApiKey = ref(props.apiKey)
const localModel = ref(props.model)

function handleSave() {
  emit('save', {
    endpoint: localEndpoint.value,
    apiKey: localApiKey.value,
    model: localModel.value
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('cancel')">
      <div class="modal">
        <div class="modal-header">
          <span>🔐 API Configuration</span>
          <button class="close-btn" @click="emit('cancel')">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Endpoint</label>
            <input v-model="localEndpoint" type="text" placeholder="https://api.minimaxi.com" class="modal-input" />
          </div>
          <div class="field">
            <label>API Key</label>
            <input v-model="localApiKey" type="password" placeholder="Enter your API key" class="modal-input" />
          </div>
          <div class="field">
            <label>Default Model</label>
            <select v-model="localModel" class="modal-input">
              <option value="image-01">image-01</option>
              <option value="image-01-live">image-01-live</option>
            </select>
          </div>
          <p class="hint">API key is stored in localStorage and never sent anywhere except the specified endpoint.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="emit('cancel')">Cancel</button>
            <button class="modal-save" @click="handleSave">Save</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 600;
  font-size: 15px;
}

.modal-header .close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.modal-header .close-btn:hover {
  background: #e8e8e8;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}

.modal-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.modal-input:focus {
  border-color: #3b82f6;
}

.hint {
  font-size: 11px;
  color: #999;
  margin: 0 0 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-cancel {
  padding: 8px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
}

.modal-save {
  padding: 8px 16px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #fff;
}

.modal-save:hover {
  background: #2563eb;
}
</style>
