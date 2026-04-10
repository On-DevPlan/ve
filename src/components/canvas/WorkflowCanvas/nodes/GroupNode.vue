<script setup>
defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({ label: 'Group', color: '#8b5cf6' }) }
})
</script>

<template>
  <div class="group-node">
    <div class="group-label">{{ data?.label }}</div>
  </div>
</template>

<style scoped>
.group-node {
  position: relative;
  background: rgba(139, 92, 246, 0.06);
  border: 2px dashed #8b5cf6;
  border-radius: 12px;
  min-width: 200px;
  min-height: 150px;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
}

.group-label {
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #8b5cf6;
  pointer-events: none;
  user-select: none;
}
</style>
