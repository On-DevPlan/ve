import { ref } from 'vue'

// Default data per node type
const defaultNodeData = {
  image: { label: 'Image', imageUrl: '', imageWidth: 200, imageHeight: 150 },
  input: { label: 'Input', inputText: '', placeholder: 'Enter content...' },
  text: { label: 'Text', content: 'Display content', fontSize: 14 }
}

// Default position generator
function getDefaultPosition() {
  return { x: 300 + Math.random() * 200, y: 200 + Math.random() * 150 }
}

/**
 * Composable for managing WorkflowCanvas node CRUD operations and import/export.
 * @param {Ref} nodes - Ref to nodes array
 * @param {Ref} edges - Ref to edges array
 * @returns {Object} Node action handlers and state
 */
export function useNodeActions(nodes, edges) {
  const selectedNode = ref(null)

  /**
   * Creates a new node with default data for the given type
   * @param {string} type - Node type ('image', 'input', or 'text')
   * @param {Object} position - Optional explicit position { x, y }
   * @returns {Object} The newly created node
   */
  function addNode(type, position) {
    const id = `${type}-${Date.now()}`
    const newNode = {
      id,
      type,
      position: position || getDefaultPosition(),
      data: { ...defaultNodeData[type] }
    }
    nodes.value.push(newNode)
    return newNode
  }

  /**
   * Removes a node and all connected edges
   * @param {string} id - Node ID to remove
   */
  function removeNode(id) {
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (selectedNode.value?.id === id) {
      selectedNode.value = null
    }
  }

  /**
   * Removes all nodes and edges
   */
  function clearAll() {
    nodes.value = []
    edges.value = []
    selectedNode.value = null
  }

  /**
   * Downloads the workflow as a JSON file
   */
  function exportJSON() {
    const data = {
      version: '1.0',
      nodes: nodes.value,
      edges: edges.value
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflow.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Loads a workflow from a JSON file
   * @param {File} file - The JSON file to import
   * @returns {Promise<Object>} Promise resolving to imported data
   */
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (data.nodes && data.edges) {
            nodes.value = data.nodes
            edges.value = data.edges
            resolve(data)
          } else {
            reject(new Error('Invalid workflow format: missing nodes or edges'))
          }
        } catch (err) {
          reject(new Error(`Failed to parse JSON: ${err.message}`))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  /**
   * Handler for VueFlow's onNodeClick event
   * @param {Object} params - Event params containing { node }
   */
  function onNodeClick({ node }) {
    selectedNode.value = node
  }

  return {
    selectedNode,
    addNode,
    removeNode,
    clearAll,
    exportJSON,
    importJSON,
    onNodeClick
  }
}
