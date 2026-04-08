<template>
  <div ref="container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const container = ref(null)

let scene, camera, renderer, controls, ball
let animationId

class Ball extends THREE.Mesh {
  constructor() {
    const division = 2
    const g = new THREE.IcosahedronGeometry(3, division)
    const m = new THREE.MeshStandardMaterial({
      wireframe: false,
      vertexColors: true,
      metalness: 0.9,
      roughness: 0.1
    })
    g.computeVertexNormals()
    super(g, m)

    const amountPerBlock = (2 + 2 * division) * 0.5 * (division + 1)
    const totalAmount = g.attributes.position.count / 3
    const blocks = totalAmount / amountPerBlock

    g.setAttribute('color', new THREE.Float32BufferAttribute(
      Array.from({ length: g.attributes.position.count }, () => [1, 1, 1]).flat(),
      3
    ))

    const setColor = (idx, color) => {
      const cl = color.isColor ? color : new THREE.Color(color)
      const c = g.attributes.color
      c.setXYZ(idx * 3 + 0, ...cl)
      c.setXYZ(idx * 3 + 1, ...cl)
      c.setXYZ(idx * 3 + 2, ...cl)
    }

    for (let block = 0; block < blocks; block++) {
      const initBlock = block * amountPerBlock
      setColor(initBlock + 0, '#fdb515')
      setColor(initBlock + 4, '#fdb515')
      setColor(initBlock + 8, '#fdb515')
    }
  }
}

const initScene = () => {
  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000)
  camera.position.set(0, 0, 1).setLength(10)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envTex = pmremGenerator.fromScene(room, 0.04).texture
  scene.environment = envTex
  scene.background = envTex

  ball = new Ball()
  scene.add(ball)
}

const handleResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  initScene()
  animate()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
  if (renderer) {
    renderer.dispose()
    if (container.value && container.value.contains(renderer.domElement)) {
      container.value.removeChild(renderer.domElement)
    }
  }
})
</script>

<style scoped>
div {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background: #000;
}
</style>
