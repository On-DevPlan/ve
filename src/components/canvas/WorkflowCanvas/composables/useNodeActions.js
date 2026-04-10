import { ref, computed } from 'vue'

// Default data per node type
const defaultNodeData = {
  image: { label: 'Image', imageUrl: '', imageWidth: 200, imageHeight: 150 },
  textInput: { label: 'Input', inputText: '', placeholder: 'Enter content...' },
  text: { label: 'Text', content: 'Display content', fontSize: 14 },
  group: { label: 'Group', color: '#8b5cf6' }
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

  const hasSelectedNodes = computed(() => nodes.value.filter(n => n.selected).length > 0)

  function getSelectedNodes() {
    return nodes.value.filter(n => n.selected)
  }

  /**
   * Creates a new node with default data for the given type
   * @param {string} type - Node type ('image', 'input', or 'text')
   * @param {Object} position - Optional explicit position { x, y }
   * @returns {Object} The newly created node
   */
  function addNode(type, position) {
    if (!defaultNodeData[type]) {
      throw new Error(`Unknown node type: "${type}". Valid types: ${Object.keys(defaultNodeData).join(', ')}`)
    }
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
          if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
            nodes.value = data.nodes
            edges.value = data.edges
            selectedNode.value = null
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

  /**
   * Groups selected nodes under a new group node
   * @returns {Object|null} The created group node, or null if no nodes selected
   */
  function groupSelected() {
    const selected = getSelectedNodes()
    if (selected.length === 0) return null

    // Compute bounding box of selected nodes
    const xs = selected.map(n => n.position.x)
    const ys = selected.map(n => n.position.y)
    const minX = Math.min(...xs) - 30
    const minY = Math.min(...ys) - 30

    // Create group node
    const groupId = `group-${Date.now()}`
    const groupNode = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      data: { ...defaultNodeData.group },
      width: 400,
      height: 300
    }
    nodes.value.push(groupNode)

    // Set parentNode on each selected child node
    selected.forEach(child => {
      const node = nodes.value.find(n => n.id === child.id)
      if (node) {
        node.parentNode = groupId
        node.expandParent = true
      }
    })

    return groupNode
  }

  /**
   * Ungroups selected nodes (removes parent reference)
   */
  function ungroupSelected() {
    const selected = getSelectedNodes()
    selected.forEach(node => {
      const n = nodes.value.find(x => x.id === node.id)
      if (n) {
        n.parentNode = undefined
        n.expandParent = undefined
      }
    })
  }

  return {
    selectedNode,
    hasSelectedNodes,
    getSelectedNodes,
    addNode,
    removeNode,
    clearAll,
    exportJSON,
    importJSON,
    onNodeClick,
    groupSelected,
    ungroupSelected
  }
}
  