<script setup>
defineProps({
  visible: { type: Boolean, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true }
})

const emit = defineEmits(['delete', 'close'])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ctx-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
      @click.stop
    >
      <button class="ctx-item ctx-delete" @click="emit('delete')">
        🗑️ Delete
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  padding: 6px;
  min-width: 140px;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.ctx-item:hover {
  background: #f5f5f5;
}

.ctx-delete {
  color: #ef4444;
}

.ctx-delete:hover {
  background: #fef2f2;
}
</style>
