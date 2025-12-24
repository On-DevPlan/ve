<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'

const canvasContainer = ref(null)
let scene, camera, renderer
let deities = []
let particles
let animationId

// 赛博菩萨配置
const DEITIES = [
  {
    name: 'GitHub',
    icon: '🐙',
    color: 0x4078c0,
    position: { x: -8, y: 3, z: 0 },
    glowColor: 0x60a5fa
  },
  {
    name: 'GLM',
    icon: '🤖',
    color: 0x10b981,
    position: { x: 0, y: 5, z: 0 },
    glowColor: 0x34d399
  },
  {
    name: '硅基流动',
    icon: '💫',
    color: 0x8b5cf6,
    position: { x: 8, y: 3, z: 0 },
    glowColor: 0xa78bfa
  }
]

// 初始化场景
const init = () => {
  // 场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0f)
  scene.fog = new THREE.Fog(0x0a0a0f, 10, 50)

  // 相机
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 3, 15)

  // 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  canvasContainer.value.appendChild(renderer.domElement)

  // 创建环境
  createEnvironment()

  // 创建神像平台
  createDeities()

  // 创建粒子效果
  createParticles()

  // 灯光
  setupLights()

  // 动画循环
  animate()

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize)
}

// 创建环境（寺庙基础）
const createEnvironment = () => {
  // 地面 - 网格效果
  const gridHelper = new THREE.GridHelper(40, 40, 0x4c1d95, 0x1e1b4b)
  gridHelper.position.y = -2
  scene.add(gridHelper)

  // 发光地面
  const floorGeometry = new THREE.PlaneGeometry(40, 40)
  const floorMaterial = new THREE.MeshBasicMaterial({
    color: 0x0f0f1a,
    side: THREE.DoubleSide
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.01
  scene.add(floor)

  // 赛博寺庙柱子
  const pillarGeometry = new THREE.BoxGeometry(0.5, 8, 0.5)
  const pillarPositions = [
    [-12, -2], [-12, 2],
    [12, -2], [12, 2]
  ]

  pillarPositions.forEach(([x, z]) => {
    const pillarMaterial = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.3
    })
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial)
    pillar.position.set(x, 2, z)
    scene.add(pillar)

    // 柱子发光边框
    const edges = new THREE.EdgesGeometry(pillarGeometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x818cf8 })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    wireframe.position.set(x, 2, z)
    scene.add(wireframe)
  })

  // 顶部横梁
  const beamGeometry = new THREE.BoxGeometry(24.5, 0.3, 0.5)
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x4f46e5,
    transparent: true,
    opacity: 0.5
  })

  // 前后横梁
  const beamFront = new THREE.Mesh(beamGeometry, beamMaterial)
  beamFront.position.set(0, 6, -2)
  scene.add(beamFront)

  const beamBack = new THREE.Mesh(beamGeometry, beamMaterial)
  beamBack.position.set(0, 6, 2)
  scene.add(beamBack)

  // 屋顶（赛博风格）
  const roofGeometry = new THREE.ConeGeometry(10, 4, 4)
  const roofMaterial = new THREE.MeshBasicMaterial({
    color: 0x7c3aed,
    transparent: true,
    opacity: 0.4,
    wireframe: true
  })
  const roof = new THREE.Mesh(roofGeometry, roofMaterial)
  roof.position.set(0, 9, 0)
  roof.rotation.y = Math.PI / 4
  scene.add(roof)
}

// 创建神像
const createDeities = () => {
  DEITIES.forEach((deity, index) => {
    const group = new THREE.Group()

    // 悬浮平台
    const platformGeometry = new THREE.CylinderGeometry(1.5, 2, 0.3, 32)
    const platformMaterial = new THREE.MeshBasicMaterial({
      color: deity.color,
      transparent: true,
      opacity: 0.6
    })
    const platform = new THREE.Mesh(platformGeometry, platformMaterial)
    group.add(platform)

    // 平台发光环
    const ringGeometry = new THREE.TorusGeometry(1.8, 0.05, 16, 100)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: deity.glowColor
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.2
    group.add(ring)

    // 神像核心（发光球体）
    const coreGeometry = new THREE.SphereGeometry(0.8, 32, 32)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: deity.glowColor,
      transparent: true,
      opacity: 0.8
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    core.position.y = 1.5
    group.add(core)

    // 外层光晕
    const glowGeometry = new THREE.SphereGeometry(1.2, 32, 32)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: deity.glowColor,
      transparent: true,
      opacity: 0.3
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.y = 1.5
    group.add(glow)

    // 名字标签（使用 Canvas 创建纹理）
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, 256, 128)
    ctx.font = 'bold 48px Arial'
    ctx.fillStyle = '#' + deity.glowColor.toString(16).padStart(6, '0')
    ctx.textAlign = 'center'
    ctx.fillText(deity.icon, 128, 50)
    ctx.font = '24px Arial'
    ctx.fillText(deity.name, 128, 90)

    const texture = new THREE.CanvasTexture(canvas)
    const labelGeometry = new THREE.PlaneGeometry(2, 1)
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    })
    const label = new THREE.Mesh(labelGeometry, labelMaterial)
    label.position.y = 3
    group.add(label)

    // 设置初始位置
    group.position.set(deity.position.x, deity.position.y, deity.position.z)

    // 存储引用用于动画
    deities.push({
      group,
      baseY: deity.position.y,
      phase: index * (Math.PI * 2 / 3), // 不同相位
      speed: 0.5 + index * 0.2
    })

    scene.add(group)
  })
}

// 创建粒子效果
const createParticles = () => {
  const particleCount = 1000
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount; i++) {
    // 随机位置
    positions[i * 3] = (Math.random() - 0.5) * 40
    positions[i * 3 + 1] = Math.random() * 15
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40

    // 赛博朋克颜色（紫色、青色、粉色）
    const colorChoice = Math.random()
    if (colorChoice < 0.33) {
      colors[i * 3] = 0.5     // R
      colors[i * 3 + 1] = 0.2 // G
      colors[i * 3 + 2] = 1.0 // B (紫色)
    } else if (colorChoice < 0.66) {
      colors[i * 3] = 0.2     // R
      colors[i * 3 + 1] = 1.0 // G
      colors[i * 3 + 2] = 1.0 // B (青色)
    } else {
      colors[i * 3] = 1.0     // R
      colors[i * 3 + 1] = 0.2 // G
      colors[i * 3 + 2] = 0.8 // B (粉色)
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.8
  })

  particles = new THREE.Points(geometry, material)
  scene.add(particles)
}

// 设置灯光
const setupLights = () => {
  // 环境光
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  scene.add(ambientLight)

  // 主光源
  const mainLight = new THREE.PointLight(0x8b5cf6, 2, 50)
  mainLight.position.set(0, 10, 0)
  scene.add(mainLight)

  // 彩色点光源
  const colors = [0x3b82f6, 0x10b981, 0x8b5cf6]
  colors.forEach((color, i) => {
    const light = new THREE.PointLight(color, 1, 20)
    light.position.set(
      (i - 1) * 8,
      5,
      5
    )
    scene.add(light)
  })
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)

  const time = Date.now() * 0.001

  // 悬浮动画
  deities.forEach((deity, index) => {
    deity.group.position.y = deity.baseY + Math.sin(time * deity.speed + deity.phase) * 0.3
    deity.group.rotation.y += 0.01
  })

  // 粒子动画
  if (particles) {
    particles.rotation.y += 0.0005
    particles.rotation.x += 0.0002
  }

  // 相机轻微移动
  camera.position.x = Math.sin(time * 0.2) * 0.5
  camera.position.y = 3 + Math.sin(time * 0.3) * 0.3
  camera.lookAt(0, 3, 0)

  renderer.render(scene, camera)
}

// 窗口大小调整
const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// 清理
const cleanup = () => {
  window.removeEventListener('resize', onWindowResize)
  cancelAnimationFrame(animationId)

  if (renderer) {
    renderer.dispose()
  }

  // 清理几何体和材质
  scene.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose()
    }
    if (object.material) {
      if (object.material.map) {
        object.material.map.dispose()
      }
      object.material.dispose()
    }
  })
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div ref="canvasContainer" class="cyber-temple"></div>
</template>

<style scoped>
.cyber-temple {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0a0f;
}
</style>
