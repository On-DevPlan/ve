<template>
  <div id="three-container" ref="container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const container = ref(null)
let scene, camera, renderer
let cards = []
let stars = []
let animationId

// 评论数据
const comments = [
  {
    id: 1,
    avatar: '👤',
    username: 'NENG',
    content: '月亮是你的温柔，星空是你的陪伴',
    time: '2024-7-31',
    likes: 211,
    replies: 954
  },
  {
    id: 2,
    avatar: '🌙',
    username: '星语者',
    content: '晚风轻抚着思念，月光洒满了回忆',
    time: '2024-7-30',
    likes: 520,
    replies: 138
  },
  {
    id: 3,
    avatar: '⭐',
    username: '夜游神',
    content: '在无尽的黑夜里，你是唯一的光',
    time: '2024-7-29',
    likes: 892,
    replies: 421
  }
]

// 初始化Three.js场景
const initScene = () => {
  // 创建场景
  scene = new THREE.Scene()

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 0, 15)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.value.appendChild(renderer.domElement)

  // 创建渐变背景
  createGradientBackground()

  // 创建评论卡片
  createCommentCards()

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // 添加主光源
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 5, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 添加粉色点光源
  const pointLight1 = new THREE.PointLight(0xff69b4, 0.5, 20)
  pointLight1.position.set(-5, 0, 5)
  scene.add(pointLight1)

  // 添加紫色点光源
  const pointLight2 = new THREE.PointLight(0x9370db, 0.5, 20)
  pointLight2.position.set(5, 0, 5)
  scene.add(pointLight2)

  // 添加星空粒子效果
  createStarField()
}

// 创建粉紫色渐变背景
const createGradientBackground = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 512
  const context = canvas.getContext('2d')

  const gradient = context.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#ffeef8')
  gradient.addColorStop(0.5, '#e6d5ff')
  gradient.addColorStop(1, '#d4a5ff')

  context.fillStyle = gradient
  context.fillRect(0, 0, 2, 512)

  const texture = new THREE.CanvasTexture(canvas)
  scene.background = texture
}

// 创建评论卡片
const createCommentCards = () => {
  comments.forEach((comment, index) => {
    createSingleCard(comment, index)
  })

  // 创建"热门推荐"板块
  createHotRecommendation()

  // 创建红色加号按钮
  createAddButton()
}

// 创建单个卡片
const createSingleCard = (comment, index) => {
  const group = new THREE.Group()

  // 创建卡片背景
  const cardGeometry = new THREE.PlaneGeometry(6, 2)
  const cardMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.05,
    side: THREE.DoubleSide
  })
  const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial)

  // 创建圆角效果
  const borderRadius = 0.1
  cardMesh.position.y = -index * 3
  cardMesh.position.z = -index * 0.5

  // 创建文字纹理
  const textTexture = createTextTexture(comment)
  const textMaterial = new THREE.MeshBasicMaterial({
    map: textTexture,
    transparent: true,
    alphaTest: 0.01
  })
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 1.5),
    textMaterial
  )
  textMesh.position.copy(cardMesh.position)
  textMesh.position.z += 0.01

  // 创建头像
  const avatarGeometry = new THREE.CircleGeometry(0.3, 32)
  const avatarMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb6c1
  })
  const avatarMesh = new THREE.Mesh(avatarGeometry, avatarMaterial)
  avatarMesh.position.copy(cardMesh.position)
  avatarMesh.position.x -= 2.5
  avatarMesh.position.y += 0.5
  avatarMesh.position.z += 0.02

  // 创建心形图标
  const heartGeometry = createHeartGeometry()
  const heartMaterial = new THREE.MeshBasicMaterial({
    color: 0xff69b4
  })
  const heartMesh = new THREE.Mesh(heartGeometry, heartMaterial)
  heartMesh.position.copy(cardMesh.position)
  heartMesh.position.x += 1.5
  heartMesh.position.y -= 0.6
  heartMesh.position.z += 0.02

  group.add(cardMesh)
  group.add(textMesh)
  group.add(avatarMesh)
  group.add(heartMesh)

  // 添加动画
  group.userData = {
    originalY: cardMesh.position.y,
    floatOffset: Math.random() * Math.PI * 2
  }

  scene.add(group)
  cards.push(group)
}

// 创建文字纹理
const createTextTexture = (comment) => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')

  // 背景
  context.fillStyle = 'rgba(255, 255, 255, 0)'
  context.fillRect(0, 0, 512, 128)

  // 用户名
  context.fillStyle = '#333333'
  context.font = 'bold 20px Arial'
  context.fillText(comment.username, 80, 30)

  // 内容
  context.font = '16px Arial'
  context.fillText(comment.content, 80, 60)

  // 时间
  context.fillStyle = '#999999'
  context.font = '14px Arial'
  context.fillText(comment.time, 80, 90)

  // 点赞数
  context.fillStyle = '#ff69b4'
  context.fillText('❤ ' + comment.likes, 300, 90)

  // 回复数
  context.fillText('💬 ' + comment.replies, 400, 90)

  return new THREE.CanvasTexture(canvas)
}

// 创建星空粒子效果
const createStarField = () => {
  const starsGeometry = new THREE.BufferGeometry()
  const starsCount = 200
  const positions = new Float32Array(starsCount * 3)
  const colors = new Float32Array(starsCount * 3)

  for (let i = 0; i < starsCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 50
    positions[i + 1] = (Math.random() - 0.5) * 50
    positions[i + 2] = (Math.random() - 0.5) * 20

    const color = new THREE.Color()
    color.setHSL(Math.random() * 0.2 + 0.5, 0.5, Math.random() * 0.5 + 0.5)
    colors[i] = color.r
    colors[i + 1] = color.g
    colors[i + 2] = color.b
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const starsMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  })

  const starsMesh = new THREE.Points(starsGeometry, starsMaterial)
  scene.add(starsMesh)
  stars.push(starsMesh)
}

// 创建心形几何体
const createHeartGeometry = () => {
  const shape = new THREE.Shape()
  const x = 0, y = 0
  shape.moveTo(x + 0.5, y + 0.5)
  shape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y)
  shape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7)
  shape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9)
  shape.bezierCurveTo(x + 1.2, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7)
  shape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1, y)
  shape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5)

  return new THREE.ShapeGeometry(shape)
}

// 创建热门推荐板块
const createHotRecommendation = () => {
  const group = new THREE.Group()

  // 背景
  const bgGeometry = new THREE.PlaneGeometry(8, 3)
  const bgMaterial = new THREE.MeshPhongMaterial({
    color: 0xffe4e1,
    emissive: 0xffe4e1,
    emissiveIntensity: 0.1
  })
  const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial)
  bgMesh.position.y = -10

  // 标题
  const titleTexture = createTitleTexture('热门推荐')
  const titleMaterial = new THREE.MeshBasicMaterial({
    map: titleTexture,
    transparent: true
  })
  const titleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 0.5),
    titleMaterial
  )
  titleMesh.position.copy(bgMesh.position)
  titleMesh.position.y += 1
  titleMesh.position.z += 0.01

  group.add(bgMesh)
  group.add(titleMesh)
  scene.add(group)
}

// 创建加号按钮
const createAddButton = () => {
  const group = new THREE.Group()

  // 圆形背景
  const buttonGeometry = new THREE.CircleGeometry(0.5, 32)
  const buttonMaterial = new THREE.MeshPhongMaterial({
    color: 0xff4444,
    emissive: 0xff4444,
    emissiveIntensity: 0.2
  })
  const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial)
  buttonMesh.position.set(3.5, 0, 2)

  // 加号 - 横线
  const hLineGeometry = new THREE.PlaneGeometry(0.3, 0.05)
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
  })
  const hLineMesh = new THREE.Mesh(hLineGeometry, lineMaterial)
  hLineMesh.position.copy(buttonMesh.position)
  hLineMesh.position.z += 0.01

  // 加号 - 竖线
  const vLineMesh = new THREE.Mesh(hLineGeometry, lineMaterial)
  vLineMesh.position.copy(buttonMesh.position)
  vLineMesh.position.z += 0.01
  vLineMesh.rotation.z = Math.PI / 2

  group.add(buttonMesh)
  group.add(hLineMesh)
  group.add(vLineMesh)

  // 添加旋转动画
  group.userData = {
    isButton: true
  }

  scene.add(group)
  cards.push(group)
}

// 创建标题纹理
const createTitleTexture = (text) => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')

  context.fillStyle = 'rgba(255, 255, 255, 0)'
  context.fillRect(0, 0, 256, 64)

  context.fillStyle = '#ff1493'
  context.font = 'bold 32px Arial'
  context.textAlign = 'center'
  context.fillText(text, 128, 42)

  return new THREE.CanvasTexture(canvas)
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  const time = Date.now() * 0.001

  // 更新星空动画
  stars.forEach(star => {
    star.rotation.y = time * 0.05
    star.rotation.x = time * 0.02
  })

  // 更新卡片动画
  cards.forEach((card, index) => {
    if (card.userData.isButton) {
      // 按钮旋转动画
      card.rotation.z = Math.sin(time * 2) * 0.1
      card.scale.set(1 + Math.sin(time * 3) * 0.05, 1 + Math.sin(time * 3) * 0.05, 1)
    } else if (card.userData.originalY !== undefined) {
      // 浮动动画
      card.position.y = card.userData.originalY + Math.sin(time + card.userData.floatOffset) * 0.1
      card.rotation.z = Math.sin(time * 0.5 + card.userData.floatOffset) * 0.02
    }
  })

  // 相机缓慢移动
  camera.position.x = Math.sin(time * 0.1) * 2
  camera.position.y = Math.cos(time * 0.15) * 1
  camera.lookAt(0, -3, 0)

  // 光源动画
  const pointLight1 = scene.children.find(child => child instanceof THREE.PointLight && child.color.getHex() === 0xff69b4)
  const pointLight2 = scene.children.find(child => child instanceof THREE.PointLight && child.color.getHex() === 0x9370db)

  if (pointLight1 && pointLight2) {
    pointLight1.intensity = 0.5 + Math.sin(time * 2) * 0.2
    pointLight2.intensity = 0.5 + Math.cos(time * 2) * 0.2
  }

  renderer.render(scene, camera)
}

// 处理窗口大小变化
const handleResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// 处理鼠标移动
const handleMouseMove = (event) => {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  let hovered = false

  cards.forEach((card) => {
    const intersects = raycaster.intersectObject(card, true)

    if (intersects.length > 0 && !card.userData.isButton) {
      if (!card.userData.hovered) {
        card.userData.hovered = true
        card.scale.set(1.05, 1.05, 1)
      }
      hovered = true
    } else {
      if (card.userData.hovered) {
        card.userData.hovered = false
        card.scale.set(1, 1, 1)
      }
    }
  })

  renderer.domElement.style.cursor = hovered ? 'pointer' : 'default'
}

// 处理点击事件
const handleClick = (event) => {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  cards.forEach((card) => {
    if (card.userData.isButton) {
      const intersects = raycaster.intersectObject(card, true)
      if (intersects.length > 0) {
        // 添加点击动画
        card.scale.set(0.9, 0.9, 1)
        setTimeout(() => {
          card.scale.set(1.2, 1.2, 1)
          setTimeout(() => {
            card.scale.set(1, 1, 1)
          }, 150)
        }, 100)
      }
    }
  })
}

onMounted(() => {
  initScene()
  animate()

  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('click', handleClick)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('click', handleClick)

  // 清理资源
  cards.forEach(card => {
    card.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  })

  stars.forEach(star => {
    star.geometry.dispose()
    star.material.dispose()
  })

  if (renderer) {
    renderer.dispose()
    container.value.removeChild(renderer.domElement)
  }
})
</script>

<style scoped>
#three-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}
</style>