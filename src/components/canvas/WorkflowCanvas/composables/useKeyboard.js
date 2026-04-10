import { onMounted, onUnmounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'

const PAN_SPEED = 8 // pixels per frame

const keys = { w: false, a: false, s: false, d: false }
let rafId = null

/**
 * Composable for smooth WASD canvas panning (hold to pan continuously).
 * Active only when no node input is focused (checked via focusedNodeId ref).
 * @param {Ref} focusedNodeId - Ref<string|null> indicating currently focused node
 */
export function useKeyboard(focusedNodeId) {
  const { getViewport, setViewport } = useVueFlow()

  function tick() {
    if (focusedNodeId?.value) {
      rafId = null
      return
    }

    const active = keys.w || keys.a || keys.s || keys.d
    if (active) {
      const vp = getViewport()
      const dx = (keys.a ? PAN_SPEED : 0) - (keys.d ? PAN_SPEED : 0)
      const dy = (keys.w ? PAN_SPEED : 0) - (keys.s ? PAN_SPEED : 0)
      setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 0 })
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = null
    }
  }

  function handleKeyDown(event) {
    if (focusedNodeId?.value) return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const key = event.key.toLowerCase()
    if (!['w', 'a', 's', 'd'].includes(key)) return

    if (keys[key]) return // already held
    keys[key] = true

    if (!rafId) {
      rafId = requestAnimationFrame(tick)
    }
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase()
    keys[key] = false

    // If all keys released, stop the loop
    if (!keys.w && !keys.a && !keys.s && !keys.d) {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  })

  return {}
}
