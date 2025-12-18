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
    { username: '22 月光守护者', content: '这份温柔让人感动', likes: 189, replies: 156 }
  ]

  const shortComments = [
    '暖心不凡', '爱你！', '太治愈了', '感动到哭',
    '温柔治愈', '人间美好', '温暖如初', '治愈系',
    '美好时光', '温柔以待', '爱心满满', '暖暖的'
  ]

  const comments = []
  // 主评论
  mainComments.forEach((comment, i) => {
    comments.push({
      ...comment,
      id: i,
      type: 'main',
      color: new THREE.Color().setHSL(0.9, 0.6, 0.7)
    })
  })

  // 短评弹幕
  for (let i = 0; i < 30; i++) {
    comments.push({
      id: mainComments.length + i,
      type: 'short',
      content: shortComments[Math.floor(Math.random() * shortComments.length)],
      color: new THREE.Color().setHSL(0.85 + Math.random() * 0.1, 0.5, 0.8)
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
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 0, 50)

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

// 创建粉紫渐变背景
const createGradientBackground = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')

  // 创建径向渐变，从中心向外的粉紫渐变
  const gradient = context.createRadialGradient(256, 256, 50, 256, 256, 300)
  gradient.addColorStop(0, 'rgba(255, 200, 220, 0.9)')
  gradient.addColorStop(0.3, 'rgba(255, 182, 193, 0.7)')
  gradient.addColorStop(0.5, 'rgba(221, 160, 221, 0.6)')
  gradient.addColorStop(0.7, 'rgba(218, 112, 214, 0.5)')
  gradient.addColorStop(1, 'rgba(147, 112, 219, 0.3)')

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
  const particlesCount = 100
  const positions = new Float32Array(particlesCount * 3)
  const colors = new Float32Array(particlesCount * 3)

  for (let i = 0; i < particlesCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 150
    positions[i + 1] = (Math.random() - 0.5) * 150
    positions[i + 2] = -30 + Math.random() * 40

    const color = new THREE.Color()
    color.setHSL(0.9 + Math.random() * 0.1, 0.7, 0.8)
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

  // 柔和的点光源
  const pointLight1 = new THREE.PointLight(0xffb6c1, 0.8, 100)
  pointLight1.position.set(-30, 20, 20)
  scene.add(pointLight1)

  const pointLight2 = new THREE.PointLight(0xda70d6, 0.8, 100)
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

  mainComments.forEach((comment, index) => {
    setTimeout(() => {
      createCommentCard(comment, index)
    }, index * 800) // 延迟创建，形成波浪效果
  })
}

// 创建单个评论卡片
const createCommentCard = (comment, index) => {
  // 创建卡片组
  const cardGroup = new THREE.Group()

  // 创建卡片背景（磨砂玻璃效果）
  const cardGeometry = new THREE.BoxGeometry(20, 8, 1)

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
  const textGeometry = new THREE.PlaneGeometry(18, 6)
  const textMesh = new THREE.Mesh(textGeometry, textMaterial)
  textMesh.position.z = 0.51
  cardGroup.add(textMesh)

  // 添加高光边缘
  const edgeGeometry = new THREE.BoxGeometry(20.2, 8.2, 1.1)
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: comment.color,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide
  })
  const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial)
  cardGroup.add(edgeMesh)

  // 设置初始位置（3D空间中）
  const angle = (index / 3) * Math.PI * 2
  const radius = 15
  cardGroup.position.x = Math.cos(angle) * radius
  cardGroup.position.y = Math.sin(angle) * radius
  cardGroup.position.z = Math.random() * 10 - 5

  // 初始动画参数
  cardGroup.scale.set(0.8, 0.8, 0.8)
  cardGroup.rotation.z = (Math.random() - 0.5) * 0.3
  cardGroup.visible = false

  // 保存动画数据
  cardGroup.userData = {
    type: 'card',
    comment: comment,
    targetPosition: cardGroup.position.clone(),
    targetScale: new THREE.Vector3(1, 1, 1),
    targetRotation: new THREE.Vector3(0, 0, 0),
    animationStart: time,
    bouncePhase: 0,
    floatOffset: Math.random() * Math.PI * 2,
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

    // 入场动画（0.8秒）
    if (elapsed < 0.8) {
      if (!card.visible) {
        card.visible = true
      }

      const progress = elapsed / 0.8
      const easeProgress = easeOutElastic(progress)

      // Z轴旋转 + 缩放
      card.rotation.z = userData.targetRotation.z + (1 - easeProgress) * 0.3
      card.scale.setScalar(0.8 + easeProgress * 0.2)

      // 位置动画
      card.position.lerpVectors(
        userData.targetPosition.clone().add(new THREE.Vector3(0, 0, 20)),
        userData.targetPosition,
        easeProgress
      )

      // 透明度动画
      card.traverse((child) => {
        if (child.material) {
          if (child.material.transparent !== undefined) {
            child.material.opacity = easeProgress
          }
        }
      })
    }

    // 弹性震动动画
    if (elapsed > 0.8 && elapsed < 1.6) {
      userData.bouncePhase += 0.1
      const bounceAmount = Math.sin(userData.bouncePhase * 2) * Math.exp(-userData.bouncePhase * 0.5) * 0.05
      card.scale.setScalar(1 + bounceAmount)
    }

    // 持续的浮动效果
    if (elapsed >= 0.8) {
      const floatY = Math.sin(time * 0.3 + userData.floatOffset) * 0.5
      const floatX = Math.cos(time * 0.2 + userData.floatOffset) * 0.3
      card.position.x = userData.targetPosition.x + floatX
      card.position.y = userData.targetPosition.y + floatY

      // 微妙的旋转
      card.rotation.z = Math.sin(time * 0.5 + userData.floatOffset) * 0.02

      // 更新点赞数动画
      if (userData.currentLikes < userData.targetLikes) {
        userData.currentLikes = Math.min(userData.currentLikes + 5, userData.targetLikes)
        // 更新纹理以显示新的点赞数
        const newTexture = createCommentTextTexture({
          ...userData.comment,
          likes: Math.floor(userData.currentLikes)
        })
        card.children[1].material.map = newTexture
        card.children[1].material.needsUpdate = true
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

  // 相机缓慢移动
  camera.position.x = Math.sin(time * 0.1) * 2
  camera.position.y = Math.cos(time * 0.15) * 1
  camera.lookAt(scene.position)

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
      // 鼠标悬停效果：略微放大并停止移动
      card.scale.setScalar(1.05)
      hovered = true

      // 更新鼠标样式
      renderer.domElement.style.cursor = 'pointer'
    } else {
      // 恢复正常大小
      if (card.scale.x > 1.01) {
        card.scale.setScalar(1)
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
      // 点击时产生弹跳动画
      card.userData.bouncePhase = 0

      // 增加点赞数
      card.userData.targetLikes += 1

      // 创建粒子爆炸效果
      createParticleExplosion(card.position)
    }
  })
}

// 创建粒子爆炸效果
const createParticleExplosion = (position) => {
  const particleCount = 20
  const particles = []

  for (let i = 0; i < particleCount; i++) {
    const particleGeometry = new THREE.SphereGeometry(0.2)
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.9 + Math.random() * 0.1, 0.7, 0.8),
      transparent: true,
      opacity: 1
    })
    const particle = new THREE.Mesh(particleGeometry, particleMaterial)

    particle.position.copy(position)
    particle.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    )

    particle.life = 1
    particles.push(particle)
    scene.add(particle)
  }

  // 更新粒子动画
  const updateParticles = () => {
    particles.forEach((particle, index) => {
      particle.position.add(particle.velocity)
      particle.life -= 0.02
      particle.material.opacity = particle.life

      if (particle.life <= 0) {
        scene.remove(particle)
        particle.geometry.dispose()
        particle.material.dispose()
        particles.splice(index, 1)
      }
    })

    if (particles.length > 0) {
      requestAnimationFrame(updateParticles)
    }
  }
  updateParticles()
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