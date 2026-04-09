# WorkflowCanvas Node Infrastructure Design

## Goal

Build a reusable node infrastructure for the WorkflowCanvas component, supporting ImageNode, InputNode, and TextNode. This serves as the foundation for a future AI image orchestration canvas.

## Directory Structure

```
WorkflowCanvas/
├── component.js              # Component config (auto-discovery)
├── index.vue                 # Entry: canvas + toolbar + property panel
├── nodes/                    # Node components (markRaw registered)
│   ├── ImageNode.vue         # Image node (paste/drag/upload)
│   ├── InputNode.vue         # Input node (editable text input)
│   └── TextNode.vue          # Text node (read-only display)
└── composables/              # Shared logic
    ├── useNodeActions.js     # Node/edge CRUD + import/export
    └── useClipboard.js       # Clipboard paste + file drop handling
```

## Node Components

All nodes use VueFlow custom component registration via `markRaw`. Each receives `{ id, data }` props and emits data changes via `useVueFlow().findNode(id).data`.

### ImageNode

- **Sources**: Ctrl+V paste, file drag-and-drop, click-to-upload
- **Display**: Thumbnail preview with configurable width/height
- **Handle layout**: Left input Handle + Right output Handle
- **Data shape**:
  ```js
  { label: 'Image', imageUrl: 'blob:...', imageWidth: 200, imageHeight: 150 }
  ```
- **Behavior**:
  - Empty state: shows upload zone with dashed border and icon
  - Has image state: shows image thumbnail with resize handles
  - Supports paste from clipboard (listens to global paste event via useClipboard)
  - Supports drag-drop of image files onto the node
  - Click upload via hidden `<input type="file" accept="image/*">`
  - Stores image as blob URL (for demo scope; production would use uploaded URL)

### InputNode

- **Display**: Editable text input with label
- **Handle layout**: Left input Handle + Right output Handle
- **Data shape**:
  ```js
  { label: 'Input', inputText: '', placeholder: 'Enter content...' }
  ```
- **Behavior**:
  - Click to focus the input field
  - Supports multi-line input (textarea)
  - Data updates on input via `v-model`

### TextNode

- **Display**: Read-only text content display
- **Handle layout**: Left input Handle + Right output Handle
- **Data shape**:
  ```js
  { label: 'Text', content: 'Display content', fontSize: 14 }
  ```
- **Behavior**:
  - Renders text content with configurable font size
  - Supports multi-line text
  - Editable via property panel (double-click to edit inline is optional)

## Composables

### useNodeActions(nodes, edges)

Accepts `nodes` and `edges` refs, returns:
- `addNode(type, position?)` - creates a new node with default data for the given type
- `removeNode(id)` - removes node and its connected edges
- `clearAll()` - removes all nodes and edges
- `exportJSON()` - downloads workflow as JSON file
- `importJSON(file)` - loads workflow from JSON file
- `selectedNode` - ref tracking the currently selected node
- `onNodeClick` handler - wired to VueFlow's onNodeClick

Default positions: random offset from viewport center.

### useClipboard(nodes, addNodeFn)

Accepts `nodes` ref and `addNode` function, returns:
- `enablePaste()` - starts listening to document paste events
- `disablePaste()` - removes paste listener
- `onDrop(event)` - handler for file drop events
- `onDragover(event)` - handler for dragover (prevents default)

Behavior:
- On paste: checks clipboard for image data (DataTransfer items), reads as blob URL, calls `addNode('image')` with imageUrl set
- On drop: checks dropped files for image types, reads as blob URL, creates ImageNode at drop position

## Entry Component (index.vue)

Structure:
1. **Toolbar** (top bar):
   - Add buttons: Image, Input, Text
   - Actions: Delete selected, Clear all, Export, Import
2. **Canvas** (VueFlow):
   - Registers node types via markRaw
   - Wires up composables
   - Handles node click, edge connection
   - Drag-drop zone for image files
3. **Property Panel** (right side, conditional):
   - Shows when a node is selected
   - Displays node type, ID, position
   - Type-specific properties (imageUrl for ImageNode, inputText for InputNode, content for TextNode)

## Technical Notes

- VueFlow version: `@vue-flow/core ^1.48.2`
- Node registration: `markRaw(Component)` passed to VueFlow's `:node-types` prop
- All nodes include Handle components from `@vue-flow/core` for connection points
- Images stored as blob URLs (suitable for demo; production would need upload API)
- No external state management; state lives in component refs passed through composables

## Scope

- This iteration: 3 node types (Image, Input, Text) with full CRUD and import/export
- Future: AI model node, group/container node, node search/filter, undo/redo
