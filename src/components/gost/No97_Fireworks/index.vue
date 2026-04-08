<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
let gl, animFrameId
let fireworks = []
let tick = 0
const sins = []
const coss = []

const opts = {
  projectileAlpha: .8,
  projectileLineWidth: 1.3,
  fireworkAngleSpan: 4,
  baseFireworkVel: 3.5,
  addedFireworkVel: 3,
  gravity: .03,
  lowVelBoundary: -.2,
  xFriction: .995,
  baseShardVel: 1,
  addedShardVel: .2,
  fireworks: 1000,
  baseShardsParFirework: 10,
  addedShardsParFirework: 10,
  shardFireworkVelMultiplier: .3,
  initHueMultiplier: 1 / 360,
  runHueAdder: .1 / 360
}

const h2rgb = (h) => {
  return [0, 4, 2].map(i => Math.max(0, Math.min(1, Math.abs((h * 6 + i) % 6 - 3) - 1)))
}

class Firework {
  constructor() {
    this.reset()
    this.shards = []
    for (let i = 0; i < maxShardsParFirework; ++i) {
      this.shards.push(new Shard(this))
    }
  }

  reset() {
    const angle = -Math.PI / 2 + (Math.random() - .5) * opts.fireworkAngleSpan
    const vel = opts.baseFireworkVel + opts.addedFireworkVel * Math.random()
    this.mode = 0
    this.vx = vel * Math.cos(angle)
    this.vy = vel * Math.sin(angle)
    this.x = Math.random() * w
    this.y = h
    this.hue = tick * opts.initHueMultiplier
  }

  step() {
    if (this.mode === 0) {
      const ph = this.hue
      const px = this.x
      const py = this.y
      this.hue += opts.runHueAdder
      this.x += this.vx *= opts.xFriction
      this.y += this.vy += opts.gravity
      webgl.data.push(px, py, ph, opts.projectileAlpha * .2, this.x, this.y, this.hue, opts.projectileAlpha * .2)
      if (this.vy >= opts.lowVelBoundary) {
        this.mode = 1
        this.shardAmount = opts.baseShardsParFirework + opts.addedShardsParFirework * Math.random() | 0
        const baseAngle = Math.random() * tau
        let x = Math.cos(baseAngle)
        let y = Math.sin(baseAngle)
        const sin = sins[this.shardAmount]
        const cos = coss[this.shardAmount]
        for (let i = 0; i < this.shardAmount; ++i) {
          const vel = opts.baseShardVel + opts.addedShardVel * Math.random()
          this.shards[i].reset(x * vel, y * vel)
          const X = x
          x = x * cos - y * sin
          y = y * cos + X * sin
        }
      }
    } else if (this.mode === 1) {
      this.ph = this.hue
      this.hue += opts.runHueAdder
      let allDead = true
      for (let i = 0; i < this.shardAmount; ++i) {
        const shard = this.shards[i]
        if (!shard.dead) {
          shard.step()
          allDead = false
        }
      }
      if (allDead) this.reset()
    }
  }
}

class Shard {
  constructor(parent) {
    this.parent = parent
  }

  reset(vx, vy) {
    this.x = this.parent.x
    this.y = this.parent.y
    this.vx = this.parent.vx * opts.shardFireworkVelMultiplier + vx
    this.vy = this.parent.vy * opts.shardFireworkVelMultiplier + vy
    this.starty = this.y
    this.dead = false
    this.tick = 1
  }

  step() {
    this.tick += .05
    const px = this.x
    const py = this.y
    this.x += this.vx *= opts.xFriction
    this.y += this.vy += opts.gravity
    webgl.data.push(px, py, this.parent.ph, opts.projectileAlpha / this.tick, this.x, this.y, this.parent.hue, opts.projectileAlpha / this.tick)
    if (this.y > h) this.dead = true
  }
}

let w, h, webgl, tau, maxShardsParFirework

onMounted(() => {
  const canvas = canvasRef.value
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })
  w = canvas.width = window.innerWidth
  h = canvas.height = window.innerHeight

  webgl = {
    vertexShaderSource: `
      uniform int u_mode;
      uniform vec2 u_res;
      attribute vec4 a_data;
      varying vec4 v_color;
      vec3 h2rgb(float h) {
        return clamp(abs(mod(h * 6. + vec3(0, 4, 2), 6.) - 3.) - 1., 0., 1.);
      }
      void clear() {
        gl_Position = vec4(a_data.xy, 0, 1);
        v_color = vec4(0, 0, 0, a_data.w);
      }
      void draw() {
        gl_Position = vec4(vec2(1, -1) * ((a_data.xy / u_res) * 2. - 1.), 0, 1);
        v_color = vec4(h2rgb(a_data.z), a_data.w);
      }
      void main() {
        if(u_mode == 0) draw();
        else clear();
      }
    `,
    fragmentShaderSource: `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `
  }

  const vs = gl.createShader(gl.VERTEX_SHADER)
  gl.shaderSource(vs, webgl.vertexShaderSource)
  gl.compileShader(vs)
  const fs = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(fs, webgl.fragmentShaderSource)
  gl.compileShader(fs)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.useProgram(program)

  webgl.dataAttribLoc = gl.getAttribLocation(program, 'a_data')
  webgl.dataBuffer = gl.createBuffer()
  gl.enableVertexAttribArray(webgl.dataAttribLoc)
  gl.bindBuffer(gl.ARRAY_BUFFER, webgl.dataBuffer)
  gl.vertexAttribPointer(webgl.dataAttribLoc, 4, gl.FLOAT, false, 0, 0)

  webgl.resUniformLoc = gl.getUniformLocation(program, 'u_res')
  webgl.modeUniformLoc = gl.getUniformLocation(program, 'u_mode')

  gl.viewport(0, 0, w, h)
  gl.uniform2f(webgl.resUniformLoc, w, h)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.enable(gl.BLEND)
  gl.lineWidth(opts.projectileLineWidth)

  webgl.data = []

  webgl.clear = () => {
    gl.uniform1i(webgl.modeUniformLoc, 1)
    const a = .1
    webgl.data = [-1, -1, 0, a, 1, -1, 0, a, -1, 1, 0, a, -1, 1, 0, a, 1, -1, 0, a, 1, 1, 0, a]
    webgl.draw(gl.TRIANGLES)
    gl.uniform1i(webgl.modeUniformLoc, 0)
    webgl.data.length = 0
  }

  webgl.draw = (glType) => {
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(webgl.data), gl.STATIC_DRAW)
    gl.drawArrays(glType, 0, webgl.data.length / 4)
  }

  tau = 6.283185307179586476925286766559
  maxShardsParFirework = opts.baseShardsParFirework + opts.addedShardsParFirework

  for (let i = 0; i < maxShardsParFirework; ++i) {
    sins[i] = Math.sin(tau * i / maxShardsParFirework)
    coss[i] = Math.cos(tau * i / maxShardsParFirework)
  }

  const anim = () => {
    webgl.clear()
    ++tick
    if (fireworks.length < opts.fireworks) fireworks.push(new Firework)
    fireworks.forEach(fw => fw.step())
    webgl.draw(gl.LINES)
    animFrameId = requestAnimationFrame(anim)
  }

  anim()

  const resizeHandler = () => {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight
    gl.viewport(0, 0, w, h)
    gl.uniform2f(webgl.resUniformLoc, w, h)
  }

  const clickHandler = (e) => {
    const firework = new Firework()
    firework.x = e.clientX
    firework.y = e.clientY
    firework.vx = 0
    firework.vy = 0
    fireworks.push(firework)
  }

  window.addEventListener('resize', resizeHandler)
  canvas.addEventListener('click', clickHandler)

  return () => {
    window.removeEventListener('resize', resizeHandler)
    canvas.removeEventListener('click', clickHandler)
  }
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})
</script>

<template>
  <div class="demo-wrapper">
    <canvas ref="canvasRef" id="c"></canvas>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  background-color: #111;
}
</style>
