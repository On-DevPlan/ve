import { ref } from 'vue'

/**
 * Composable for handling clipboard paste and file drag-drop for WorkflowCanvas.
 * @param {Ref} nodes - Ref to nodes array
 * @param {Function} addNodeFn - Function to add a new node
 * @returns {Object} Clipboard handlers and state
 */
export function useClipboard(nodes, addNodeFn) {
  const isDragging = ref(false)

  /**
   * Reads a file as a blob URL
   * @param {File} file - The file to read
   * @returns {Promise<string>} Promise resolving to blob URL
   */
  function readFileAsBlobUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const blob = new Blob([e.target.result], { type: file.type })
        const url = URL.createObjectURL(blob)
        resolve(url)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Finds image files from a FileList
   * @param {FileList} files - Files to filter
   * @returns {File[]} Array of image files
   */
  function getImageFiles(files) {
    return Array.from(files).filter(file => file.type.startsWith('image/'))
  }

  /**
   * Handler for dragover events - enables drop visual feedback
   * @param {DragEvent} event
   */
  function handleDragover(event) {
    event.preventDefault()
    isDragging.value = true
  }

  /**
   * Handler for dragleave events - disables drop visual feedback
   */
  function handleDragleave() {
    isDragging.value = false
  }

  /**
   * Handler for drop events - creates ImageNode from dropped image files
   * @param {DragEvent} event
   */
  async function handleDrop(event) {
    event.preventDefault()
    isDragging.value = false

    const rect = event.currentTarget.getBoundingClientRect()
    const files = event.dataTransfer?.files

    if (!files || files.length === 0) return

    const imageFiles = getImageFiles(files)

    for (const file of imageFiles) {
      try {
        const imageUrl = await readFileAsBlobUrl(file)
        const position = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        }
        const node = addNodeFn('image', position)
        if (node && node.data) {
          node.data.imageUrl = imageUrl
        }
      } catch (err) {
        console.error('Failed to add dropped image:', err)
      }
    }
  }

  /**
   * Handler for paste events - creates ImageNode from clipboard image
   * @param {ClipboardEvent} event
   */
  async function handlePaste(event) {
    event.preventDefault()

    const items = event.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        try {
          const file = item.getAsFile()
          if (!file) continue

          const imageUrl = await readFileAsBlobUrl(file)
          const node = addNodeFn('image', { x: 400, y: 250 })
          if (node && node.data) {
            node.data.imageUrl = imageUrl
          }
        } catch (err) {
          console.error('Failed to paste image:', err)
        }
        break
      }
    }
  }

  /**
   * Enables paste event listener on document
   */
  function enablePaste() {
    document.addEventListener('paste', handlePaste)
  }

  /**
   * Disables paste event listener on document
   */
  function disablePaste() {
    document.removeEventListener('paste', handlePaste)
  }

  return {
    isDragging,
    handleDrop,
    handleDragover,
    handleDragleave,
    enablePaste,
    disablePaste
  }
}
