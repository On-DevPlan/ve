<template>
  <div id="barrage-container" ref="container">
    <!-- 添加后期处理效果 -->
    <div class="overlay-effects"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const container = ref(null)
let scene, camera, renderer, composer
let commentCards = []
let shortComments = []
let animationId
let backgroundMesh
let time = 0

// 生成评论数据
const generateComments = () => {
  const usernames = ['NENG', '星语者', '夜游神', '月光骑士', '星辰大海', '梦幻泡影', '清风明月']
  const mainComments = [
    { username: 'NENG', content: '是最真挚的祝福，是善意的一路陪伴', likes: 211, replies: 934 },
    { username: '11暖心小天使', content: '愿所有美好都围绕着你', likes: 523, replies: 212 },
    { username: '22 月光守护者', content: '这份温柔让人感动', likes: 189, replies: 156 },
    { username: '樱花雨', content: '春天的花海是你眼里的星光', likes: 456, replies: 234 },
    { username: '梦蝶', content: '破茧成蝶，只为在最美的花丛中遇见你', likes: 789, replies: 312 },
    { username: '彩虹桥', content: '雨过天晴后，架起通往你心里的桥', likes: 345, replies: 167 },
    { username: '夏夜的风', content: '蝉鸣声里藏着我对你的思念', likes: 623, replies: 289 },
    { username: '向日葵', content: '我朝着阳光的方向，也朝着你的方向', likes: 834, replies: 445 },
    { username: '叶落知秋', content: '一片落叶，一段心事，一个想念的你', likes: 267, replies: 123 },
    { username: '云游者', content: '云卷云舒，看尽人间，最想念的还是你', likes: 512, replies: 234 },
    { username: '玫瑰情', content: '带刺的玫瑰，藏着我温柔的心', likes: 945, replies: 567 },
    { username: '风铃响', content: '风起时，铃声起，思念如潮涌', likes: 432, replies: 198 },
    { username: '流星语', content: '愿为你坠落，只为照亮你的路', likes: 721, replies: 376 },
    { username: '星梦缘', content: '星星点灯，照亮我们的相遇', likes: 658, replies: 423 },
    { username: '月光曲', content: '皎洁的月光下，聆听心跳的声音', likes: 543, replies: 287 }
  ]

  const shortComments = [
    '暖心不凡', '爱你！', '太治愈了', '感动到哭',
    '温柔治愈', '人间美好', '温暖如初', '治愈系',
    '美好时光', '温柔以待', '爱心满满', '暖暖的',
    '超赞！', '太美了', '心动', '喜欢💕',
    '感动', '治愈', '温暖', '美好',
    '星光', '月色', '温柔如水', '甜甜的',
    '超爱', '绝美', '心动瞬间', '满满的爱'
  ]

  const comments = []
  // 主评论
  mainComments.forEach((comment, i) => {
    comments.push({
      ...comment,
      id: i,
      type: 'main',
      color: new THREE.Color(0x888888) // 灰色
    })
  })

  // 短评弹幕
  for (let i = 0; i < 30; i++) {
    comments.push({
      id: mainComments.length + i,
      type: 'short',
      content: shortComments[Math.floor(Math.random() * shortComments.length)],
      color: new THREE.Color(0x999999) // 淡灰色
    })
  }

  return comments
}

const comments = generateComments()

// 初始化Three.js场景
const initScene = () => {
  // 创建场景
  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x000000, 50, 150)

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 0, 80) // 拉远相机以适应更大的卡片

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  container.value.appendChild(renderer.domElement)

  // 创建后期处理
  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  // 创建粉紫渐变背景
  createGradientBackground()

  // 创建评论卡片
  createCommentCards()

  // 创建短评弹幕
  createShortComments()

  // 设置光照
  setupLighting()
}

// 创建淡灰色背景
const createGradientBackground = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')

  // 创建径向渐变，从中心向外的灰色渐变
  const gradient = context.createRadialGradient(256, 256, 50, 256, 256, 300)
  gradient.addColorStop(0, 'rgba(240, 240, 240, 0.9)')
  gradient.addColorStop(0.3, 'rgba(220, 220, 220, 0.7)')
  gradient.addColorStop(0.5, 'rgba(200, 200, 200, 0.6)')
  gradient.addColorStop(0.7, 'rgba(180, 180, 180, 0.5)')
  gradient.addColorStop(1, 'rgba(160, 160, 160, 0.3)')

  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 512)

  // 添加柔和的光晕效果
  const glowGradient = context.createRadialGradient(256, 256, 100, 256, 256, 250)
  glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
  glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.fillStyle = glowGradient
  context.fillRect(0, 0, 512, 512)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  // 创建背景平面
  const bgGeometry = new THREE.PlaneGeometry(200, 200)
  const bgMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  })
  backgroundMesh = new THREE.Mesh(bgGeometry, bgMaterial)
  backgroundMesh.position.z = -50
  scene.add(backgroundMesh)

  // 添加漂浮粒子
  createFloatingParticles()
}

// 创建漂浮粒子
const createFloatingParticles = () => {
  const particlesGeometry = new THREE.BufferGeometry()
  const particlesCount = 50 // 减少粒子数量
  const positions = new Float32Array(particlesCount * 3)
  const colors = new Float32Array(particlesCount * 3)

  for (let i = 0; i < particlesCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 150
    positions[i + 1] = (Math.random() - 0.5) * 150
    positions[i + 2] = -30 + Math.random() * 40

    const color = new THREE.Color()
    const grayValue = 0.5 + Math.random() * 0.3
    color.setRGB(grayValue, grayValue, grayValue)
    colors[i] = color.r
    colors[i + 1] = color.g
    colors[i + 2] = color.b
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  })

  const particles = new THREE.Points(particlesGeometry, particlesMaterial)
  scene.add(particles)
}

// 设置光照
const setupLighting = () => {
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // 柔和的灰色点光源
  const pointLight1 = new THREE.PointLight(0xcccccc, 0.8, 100)
  pointLight1.position.set(-30, 20, 20)
  scene.add(pointLight1)

  const pointLight2 = new THREE.PointLight(0xb8b8b8, 0.8, 100)
  pointLight2.position.set(30, -20, 20)
  scene.add(pointLight2)

  // 聚光灯，增加立体感
  const spotLight = new THREE.SpotLight(0xffffff, 0.3)
  spotLight.position.set(0, 30, 40)
  spotLight.target.position.set(0, 0, 0)
  scene.add(spotLight)
  scene.add(spotLight.target)
}

// 创建评论卡片
const createCommentCards = () => {
  const mainComments = comments.filter(c => c.type === 'main')

  // 创建多列卡片流
  const columns = 5 // 列数（与createCommentCard中的保持一致）
  const rowsPerColumn = Math.ceil(mainComments.length / columns)

  // 生成更多卡片以填满屏幕
  const totalCards = 25 // 进一步减少卡片数量以优化性能
  const extendedComments = []

  for (let i = 0; i < totalCards; i++) {
    const baseComment = mainComments[i % mainComments.length]
    extendedComments.push({
      ...baseComment,
      id: i,
      // 随机调整点赞和回复数
      likes: baseComment.likes + Math.floor(Math.random() * 200),
      replies: baseComment.replies + Math.floor(Math.random() * 50)
    })
  }

  // 分批创建卡片，创建连续流动效果
  extendedComments.forEach((comment, index) => {
    const delay = index * 150 // 增加延迟时间，避免过于密集
    setTimeout(() => {
      createCommentCard(comment, index)
    }, delay)
  })
}

// 创建单个评论卡片
const createCommentCard = (comment, index) => {
  // 创建卡片组
  const cardGroup = new THREE.Group()

  // 创建卡片背景（磨砂玻璃效果）- 放大卡片尺寸
  const cardWidth = 15
  const cardHeight = 8
  const cardGeometry = new THREE.BoxGeometry(cardWidth, cardHeight, 0.5)

  // 使用自定义着色器实现磨砂玻璃效果
  const cardMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.2,
    transmission: 0.6,
    thickness: 0.5,
    transparent: true,
    opacity: 0.8,
    envMapIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.1
  })

  const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial)
  cardMesh.receiveShadow = true
  cardGroup.add(cardMesh)

  // 创建文字纹理
  const textTexture = createCommentTextTexture(comment)
  const textMaterial = new THREE.MeshBasicMaterial({
    map: textTexture,
    transparent: true,
    alphaTest: 0.01
  })
  const textGeometry = new THREE.PlaneGeometry(cardWidth * 0.9, cardHeight * 0.8)
  const textMesh = new THREE.Mesh(textGeometry, textMaterial)
  textMesh.position.z = 0.26
  cardGroup.add(textMesh)

  // 添加高光边缘
  const edgeGeometry = new THREE.BoxGeometry(cardWidth * 1.02, cardHeight * 1.02, 0.52)
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: comment.color,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide
  })
  const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial)
  cardGroup.add(edgeMesh)

  // 设置流式布局位置
  const columns = 5 // 减少列数以适应更大的卡片
  const spacingX = 18 // 增加列间距
  const spacingY = 10 // 增加行间距
  const column = index % columns
  const row = Math.floor(index / columns)

  // 计算屏幕坐标
  const screenWidth = columns * spacingX
  const startX = -screenWidth / 2 + spacingX / 2
  const x = startX + column * spacingX

  // 初始位置从屏幕底部下方开始
  const y = -40 - row * spacingY - Math.random() * 10
  const z = -10 + (Math.random() - 0.5) * 20 // 随机深度

  cardGroup.position.set(x, y, z)

  // 初始动画参数
  cardGroup.scale.set(0.8, 0.8, 0.8) // 增大初始缩放
  cardGroup.rotation.z = (Math.random() - 0.5) * 0.2
  cardGroup.visible = false

  // 保存动画数据
  cardGroup.userData = {
    type: 'card',
    comment: comment,
    startX: x,
    startY: y,
    speed: 0.1 + Math.random() * 0.05, // 向上移动速度
    floatAmplitude: 0.2 + Math.random() * 0.3, // 左右摆动幅度
    floatFrequency: 0.5 + Math.random() * 0.5, // 摆动频率
    phase: Math.random() * Math.PI * 2,
    animationStart: time,
    opacity: 0,
    targetOpacity: 0.9,
    fadeInDuration: 1,
    fadeOutY: 40, // 淡出高度
    targetLikes: comment.likes,
    currentLikes: 0,
    displayReplies: comment.replies || 0
  }

  scene.add(cardGroup)
  commentCards.push(cardGroup)
}

// 创建短评弹幕
const createShortComments = () => {
  const shortCommentList = comments.filter(c => c.type === 'short')

  shortCommentList.forEach((comment, index) => {
    setTimeout(() => {
      createShortComment(comment, index)
    }, 2000 + Math.random() * 5000) // 随机延迟开始
  })
}

// 创建单个短评弹幕
const createShortComment = (comment, index) => {
  // 创建文字纹理
  const textTexture = createShortCommentTexture(comment)

  const textMaterial = new THREE.MeshBasicMaterial({
    map: textTexture,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.DoubleSide
  })

  // 根据文字内容计算合适的宽度
  const textWidth = Math.max(comment.content.length * 0.8, 6)
  const textHeight = 2

  const textGeometry = new THREE.PlaneGeometry(textWidth, textHeight)
  const textMesh = new THREE.Mesh(textGeometry, textMaterial)

  // 设置初始位置（从顶部或左侧进入）
  const startY = 30 + Math.random() * 20
  textMesh.position.x = -50 - Math.random() * 20
  textMesh.position.y = startY
  textMesh.position.z = 15 + Math.random() * 10

  // 保存动画数据
  textMesh.userData = {
    type: 'short',
    comment: comment,
    speed: 0.3 + Math.random() * 0.2,
    initialY: startY,
    opacity: 0,
    targetOpacity: 1,
    fadeInTime: 0.5,
    fadeOutTime: 0.5,
    lifespan: 3 + Math.random() * 2,
    creationTime: time,
    blurAmount: 1
  }

  scene.add(textMesh)
  shortComments.push(textMesh)
}

// 创建评论卡片文字纹理
const createCommentTextTexture = (comment) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 1024
  canvas.height = 341

  // 清除背景
  context.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制磨砂玻璃背景
  context.fillStyle = 'rgba(255, 255, 255, 0.05)'
  context.fillRect(20, 20, canvas.width - 40, canvas.height - 40)

  // 添加微妙的渐变
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, 'rgba(255, 182, 193, 0.1)')
  gradient.addColorStop(0.5, 'rgba(221, 160, 221, 0.15)')
  gradient.addColorStop(1, 'rgba(255, 182, 193, 0.1)')
  context.fillStyle = gradient
  context.fillRect(20, 20, canvas.width - 40, canvas.height - 40)

  // 绘制边框
  context.strokeStyle = comment.color.getStyle()
  context.lineWidth = 3
  context.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

  // 添加高光边缘
  context.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  context.lineWidth = 1
  context.strokeRect(21, 21, canvas.width - 42, canvas.height - 42)

  // 设置文字样式
  context.textAlign = 'left'
  context.textBaseline = 'top'

  // 添加阴影效果
  context.shadowColor = 'rgba(0, 0, 0, 0.3)'
  context.shadowBlur = 10
  context.shadowOffsetX = 2
  context.shadowOffsetY = 2

  // 绘制用户名
  context.font = 'bold 60px Arial'
  context.fillStyle = comment.color.getStyle()
  context.fillText(comment.username, 80, 80)

  // 绘制评论内容
  context.shadowBlur = 5
  context.font = '50px Arial'
  context.fillStyle = '#ffffff'
  context.fillText(comment.content, 80, 160)

  // 绘制点赞和回复数（使用特殊的字体图标）
  context.font = '40px Arial'
  context.fillStyle = comment.color.getStyle()
  context.fillText('❤ ' + formatNumber(comment.likes) + '  ·  💬 ' + formatNumber(comment.replies || 0), 80, 240)

  return new THREE.CanvasTexture(canvas)
}

// 创建短评弹幕文字纹理
const createShortCommentTexture = (comment) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = comment.content.length * 100
  canvas.height = 200

  // 清除背景
  context.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制半透明背景
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, 'rgba(255, 182, 193, 0.2)')
  gradient.addColorStop(0.5, 'rgba(221, 160, 221, 0.3)')
  gradient.addColorStop(1, 'rgba(255, 182, 193, 0.2)')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  // 圆角效果
  context.strokeStyle = comment.color.getStyle()
  context.lineWidth = 2
  roundRect(context, 0, 0, canvas.width, canvas.height, 40)
  context.stroke()

  // 设置文字样式
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  // 发光效果
  context.shadowColor = comment.color.getStyle()
  context.shadowBlur = 10

  // 绘制文字
  context.font = 'bold 60px Arial'
  context.fillStyle = '#ffffff'
  context.fillText(comment.content, canvas.width / 2, canvas.height / 2)

  return new THREE.CanvasTexture(canvas)
}

// 辅助函数：绘制圆角矩形
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
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

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  time += 0.016 // 约60fps

  // 更新背景色彩流动
  if (backgroundMesh) {
    backgroundMesh.rotation.z = time * 0.02
    backgroundMesh.material.opacity = 0.8 + Math.sin(time * 0.5) * 0.1
  }

  // 更新评论卡片动画
  commentCards.forEach((card) => {
    const userData = card.userData
    const elapsed = time - userData.animationStart

    // 入场动画
    if (elapsed < userData.fadeInDuration && !card.visible) {
      card.visible = true
    }

    if (elapsed < userData.fadeInDuration) {
      const progress = elapsed / userData.fadeInDuration
      const easeProgress = easeOutElastic(progress)

      // 缩放动画
      const scale = 0.8 + easeProgress * 0.2 // 增大最终尺寸
      card.scale.set(scale, scale, scale)

      // 透明度动画
      userData.opacity = easeProgress * userData.targetOpacity
      card.traverse((child) => {
        if (child.material && child.material.transparent !== undefined) {
          child.material.opacity = userData.opacity
        }
      })
    }

    // 持续的向上滚动动画
    if (elapsed >= userData.fadeInDuration) {
      // 更新Y位置 - 向上移动
      card.position.y += userData.speed

      // 左右摆动效果
      const floatX = Math.sin(time * userData.floatFrequency + userData.phase) * userData.floatAmplitude
      card.position.x = userData.startX + floatX

      // 轻微的旋转
      card.rotation.z = Math.sin(time * 0.5 + userData.phase) * 0.05

      // 透明度根据高度调整
      if (card.position.y > userData.fadeOutY - 10) {
        const fadeProgress = (card.position.y - (userData.fadeOutY - 10)) / 10
        userData.opacity = userData.targetOpacity * (1 - fadeProgress)
        card.traverse((child) => {
          if (child.material && child.material.transparent !== undefined) {
            child.material.opacity = userData.opacity
          }
        })
      }

      // 更新点赞数动画
      if (userData.currentLikes < userData.targetLikes) {
        userData.currentLikes = Math.min(userData.currentLikes + 5, userData.targetLikes)
        const newTexture = createCommentTextTexture({
          ...userData.comment,
          likes: Math.floor(userData.currentLikes)
        })
        card.children[1].material.map = newTexture
        card.children[1].material.needsUpdate = true
      }

      // 重置位置 - 当卡片超出屏幕顶部时，重新从底部开始
      if (card.position.y > userData.fadeOutY) {
        card.position.y = userData.startY
        userData.phase = Math.random() * Math.PI * 2
        userData.speed = 0.1 + Math.random() * 0.05
      }
    }
  })

  // 更新短评弹幕
  shortComments.forEach((shortComment, index) => {
    const userData = shortComment.userData
    const elapsed = time - userData.creationTime

    // 入场阶段（0.5秒渐入）
    if (elapsed < userData.fadeInTime) {
      userData.opacity = elapsed / userData.fadeInTime
      shortComment.material.opacity = userData.opacity
      userData.blurAmount = 1 - (elapsed / userData.fadeInTime)
    }
    // 正常显示阶段
    else if (elapsed < userData.fadeInTime + userData.lifespan) {
      userData.opacity = 1
      shortComment.material.opacity = userData.opacity
      userData.blurAmount = 0

      // 从左到右移动
      shortComment.position.x += userData.speed

      // 添加上下浮动
      const floatOffset = Math.sin(time * 2 + index) * 0.5
      shortComment.position.y = userData.initialY + floatOffset
    }
    // 退场阶段（0.5秒渐出）
    else if (elapsed < userData.fadeInTime + userData.lifespan + userData.fadeOutTime) {
      const fadeProgress = (elapsed - userData.fadeInTime - userData.lifespan) / userData.fadeOutTime
      userData.opacity = 1 - fadeProgress
      shortComment.material.opacity = userData.opacity
      userData.blurAmount = fadeProgress

      // 继续移动
      shortComment.position.x += userData.speed
    }
    // 生命周期结束，重新生成
    else {
      scene.remove(shortComment)
      shortComment.geometry.dispose()
      shortComment.material.dispose()
      shortComments.splice(index, 1)

      // 创建新的短评
      setTimeout(() => {
        const newComment = comments.filter(c => c.type === 'short')[
          Math.floor(Math.random() * comments.filter(c => c.type === 'short').length)
        ]
        createShortComment(newComment, Date.now() + Math.random())
      }, Math.random() * 2000)
    }
  })

  // 相机固定，观察流式卡片
  camera.lookAt(0, 0, 0)

  // 渲染场景
  renderer.render(scene, camera)
}

// 弹性缓动函数
const easeOutElastic = (x) => {
  const c4 = (2 * Math.PI) / 3
  return x === 0
    ? 0
    : x === 1
    ? 1
    : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}

// 处理窗口大小变化
const handleResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight)
  }
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

  // 检测评论卡片悬停
  commentCards.forEach((card) => {
    const intersects = raycaster.intersectObject(card, true)

    if (intersects.length > 0) {
      // 鼠标悬停效果：略微放大
      if (!card.userData.hovered) {
        card.userData.hovered = true
        card.userData.originalScale = card.scale.x
      }
      card.scale.setScalar(card.userData.originalScale * 1.2)
      hovered = true

      // 更新鼠标样式
      renderer.domElement.style.cursor = 'pointer'
    } else {
      // 恢复正常大小
      if (card.userData.hovered) {
        card.userData.hovered = false
        card.scale.setScalar(card.userData.originalScale || 1)
      }
    }
  })

  // 检测短评弹幕悬停
  shortComments.forEach((shortComment) => {
    const intersects = raycaster.intersectObject(shortComment)

    if (intersects.length > 0) {
      // 鼠标悬停效果：高亮显示
      shortComment.material.emissive = new THREE.Color(0xff69b4)
      shortComment.material.emissiveIntensity = 0.2
      hovered = true
    } else {
      // 恢复正常
      if (shortComment.material.emissiveIntensity > 0) {
        shortComment.material.emissiveIntensity = 0
      }
    }
  })

  if (!hovered) {
    renderer.domElement.style.cursor = 'default'
  }
}

// 处理点击事件
const handleClick = (event) => {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  // 点击评论卡片时的交互
  commentCards.forEach((card) => {
    const intersects = raycaster.intersectObject(card, true)

    if (intersects.length > 0) {
      // 增加点赞数
      card.userData.targetLikes += 50 // 增加更多点赞以产生明显效果

      // 创建心形粒子爆炸效果
      createHeartParticleExplosion(card.position)
    }
  })
}

// 创建心形粒子爆炸效果
const createHeartParticleExplosion = (position) => {
  const particleCount = 30
  const particles = []

  for (let i = 0; i < particleCount; i++) {
    // 创建心形粒子
    const heartGeometry = createHeartGeometry()
    const heartMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.95 + Math.random() * 0.05, 0.8, 0.7),
      transparent: true,
      opacity: 1
    })
    const heart = new THREE.Mesh(heartGeometry, heartMaterial)

    // 缩小心形
    heart.scale.setScalar(0.1 + Math.random() * 0.1)

    heart.position.copy(position)

    // 心形向外爆炸的轨迹
    const angle = (i / particleCount) * Math.PI * 2
    const speed = 0.5 + Math.random() * 0.5
    heart.velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      (Math.random() - 0.5) * 0.5
    )

    heart.life = 1
    particles.push(heart)
    scene.add(heart)
  }

  // 更新心形粒子动画
  const updateHeartParticles = () => {
    particles.forEach((particle, index) => {
      particle.position.add(particle.velocity)
      particle.life -= 0.015
      particle.material.opacity = particle.life

      // 旋转和缩放动画
      particle.rotation.z += 0.1
      particle.scale.setScalar(particle.scale.x * 0.98)

      // 添加重力效果
      particle.velocity.y -= 0.01

      if (particle.life <= 0) {
        scene.remove(particle)
        particle.geometry.dispose()
        particle.material.dispose()
        particles.splice(index, 1)
      }
    })

    if (particles.length > 0) {
      requestAnimationFrame(updateHeartParticles)
    }
  }
  updateHeartParticles()
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

  // 清理评论卡片资源
  commentCards.forEach(card => {
    card.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
  })

  // 清理短评弹幕资源
  shortComments.forEach(comment => {
    comment.geometry.dispose()
    comment.material.dispose()
  })

  // 清理背景
  if (backgroundMesh) {
    backgroundMesh.geometry.dispose()
    backgroundMesh.material.dispose()
  }

  // 清理渲染器
  if (renderer) {
    renderer.dispose()
    if (container.value && container.value.contains(renderer.domElement)) {
      container.value.removeChild(renderer.domElement)
    }
  }

  // 清理后期处理
  if (composer) {
    composer.dispose()
  }
})
</script>

<style scoped>
#barrage-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: radial-gradient(circle at center, rgba(255, 200, 220, 0.1), rgba(147, 112, 219, 0.2));
}

.overlay-effects {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: radial-gradient(circle at center, transparent 30%, rgba(255, 182, 193, 0.05) 100%);
  mix-blend-mode: screen;
}

/* 添加模糊滤镜效果 */
#barrage-container::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: inherit;
  filter: blur(20px);
  opacity: 0.3;
  z-index: -1;
}
</style>