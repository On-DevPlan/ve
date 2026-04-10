import { onMounted, onUnmounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'

const PAN_STEP = 100 // pixels per key press
const KEY_STATE = {}

/**
 * Composable for WASD canvas panning.
 * Active only when no node input is focused (checked via focusedNodeId ref).
 * @param {Ref} focusedNodeId - Ref<string|null> indicating currently focused node
 * @returns {Object} cleanup
 */
export function useKeyboard(focusedNodeId) {
  const { getViewport, setViewport } = useVueFlow()

  function handleKeyDown(event) {
    // Skip if a node input is focused (user is typing)
    if (focusedNodeId?.value) return

    // Skip if modifier keys are held (typing in an input elsewhere)
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const key = event.key.toLowerCase()
    if (!['w', 'a', 's', 'd'].includes(key)) return

    // Prevent repeated keydown from held key
    if (KEY_STATE[key]) return
    KEY_STATE[key] = true

    const vp = getViewport()
    const dx = key === 'a' ? PAN_STEP : key === 'd' ? -PAN_STEP : 0
    const dy = key === 'w' ? PAN_STEP : key === 's' ? -PAN_STEP : 0

    setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 80 })
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase()
    KEY_STATE[key] = false
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
  })

  return {}
}
