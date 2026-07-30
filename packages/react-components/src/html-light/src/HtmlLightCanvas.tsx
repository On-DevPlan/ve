// HtmlLightCanvas —— html-light 的 Three.js 场景 + 物理射灯 + HTML-in-Canvas 表单。
//
// 移植自 jinruozai/HTML-Light-Demo 的 app/light/MorsLightCanvas.tsx,关键改动:
//   1. 用 three-html-render 的 ThreeHTMLRenderer 替代手动 THREE.HTMLTexture
//      (0.1.2 版并未在 THREE 上挂 HTMLTexture,ThreeHTMLRenderer 是同库更稳健的集成层:
//       它把表单 div 通过 matrix3d 定位到卡片 mesh 的屏幕投影上,并上传为 WebGL 纹理,
//       同时在表单上 stopPropagation 指针事件,使“拖灯”与“填表”互不干扰)。
//   2. 移除 three/addons/interaction/InteractionManager(原 demo 里仅作摆设,无实际命中消费)。
//   3. onPointerDown 增加 `event.target !== canvas` 守卫:点在表单上时不触发拉灯。
//   4. 表单换成可实时输入的 GuestForm(原页面是静态营销页,无真实输入)。
//
// 交互(与原 demo 一致):
//   - 左键拖拽:拉/瞄准灯,松手带摆动惯量
//   - 右键拖拽:调节光束角度
//   - 右键单击:循环灯色
//   - 双击:复位灯
// 空闲感知:场景稳定后停止 RAF,有输入/改动时 wake() 重启。

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeHTMLRenderer } from 'three-html-render/renderer';
import {
  COLOR_PRESETS,
  INITIAL_LIGHT,
  type LightingSettings,
} from './lightConfig';
import { GuestForm, GuestFormPreview } from './GuestForm';
import {
  installThreeHtmlTextureCompatibility,
  type HtmlCanvas,
} from './threeHtmlCompat';

type LightRig = {
  spot: THREE.SpotLight;
  bulbLight: THREE.PointLight;
  bulbMaterial: THREE.MeshStandardMaterial;
  glowMaterial: THREE.SpriteMaterial;
  undersideMaterial: THREE.MeshStandardMaterial;
};

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const BASE_LIGHT_DIRECTION = DOWN.clone();

export function HtmlLightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageSourceRef = useRef<HTMLDivElement>(null);
  const lightRigRef = useRef<LightRig | null>(null);
  const activeColorRef = useRef(new THREE.Color());
  const wakeRef = useRef<(() => void) | null>(null);
  const resetMotionRef = useRef<(() => void) | null>(null);
  const [lighting, setLighting] = useState<LightingSettings>(INITIAL_LIGHT);
  const lightingRef = useRef(lighting);
  const [htmlCanvasReady, setHtmlCanvasReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // 1. 安装 html-in-canvas polyfill + three.js texElementImage2D 桥接。
  useEffect(() => {
    let active = true;
    canvasRef.current?.setAttribute('layoutsubtree', '');

    void import('three-html-render/polyfill')
      .then(({ installHtmlInCanvasPolyfill }) => {
        if (!active) return;
        installHtmlInCanvasPolyfill();
        installThreeHtmlTextureCompatibility();
        setHtmlCanvasReady(true);
      })
      .catch((polyfillError: unknown) => {
        console.error('HTML-in-Canvas could not be initialized.', polyfillError);
        if (active) {
          setError('HTML-in-Canvas is not available in this browser.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // 2. 搭建 three.js 场景 + 物理灯 + 渲染循环。
  useEffect(() => {
    if (!htmlCanvasReady) return;
    const canvas = canvasRef.current as HtmlCanvas;
    const pageSource = pageSourceRef.current as HTMLDivElement;
    if (!canvas || !pageSource) return;

    let disposed = false;
    let frame = 0;
    let animationFrame = 0;
    let resizeFrame = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let stableFrames = 0;
    let pulling = false;
    let pullPointerId = -1;
    let lastPointerTime = 0;
    let pullStrength = 0;
    let beamPointerId = -1;
    let beamStartX = 0;
    let beamStartY = 0;
    let beamStartAngle = INITIAL_LIGHT.angle;
    let beamDragged = false;

    const fixedStep = 1 / 120;
    const ropeLength = 1.22;
    const pageTopToAnchor = 1.18;
    const gravity = new THREE.Vector3(0, -9.81, 0);
    const anchor = new THREE.Vector3(0, 4.72, 1.18);
    const position = new THREE.Vector3(0.16, anchor.y - ropeLength, anchor.z + 0.08);
    const previous = position.clone().add(new THREE.Vector3(0.018, 0, -0.012));
    const aimTarget = new THREE.Vector3(0, 0.3, 0.08);
    const pointerVelocity = new THREE.Vector3();
    const lastPointerTarget = aimTarget.clone();

    const temp = new THREE.Vector3();
    const tempB = new THREE.Vector3();
    const tempC = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    const ropeDirection = new THREE.Vector3();
    const lightDirection = new THREE.Vector3();
    const currentLightDirection = BASE_LIGHT_DIRECTION.clone();
    const midpoint = new THREE.Vector3();
    const swingQuaternion = new THREE.Quaternion();
    const lampQuaternion = new THREE.Quaternion();
    const cableQuaternion = new THREE.Quaternion();
    const pointer = new THREE.Vector2();
    const lampNdc = new THREE.Vector3();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.08);
    const raycaster = new THREE.Raycaster();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (rendererError) {
      console.error(rendererError);
      const errorTimer = window.setTimeout(() => {
        if (!disposed) {
          setError('This experience needs WebGL to render the light study.');
        }
      }, 0);
      return () => {
        disposed = true;
        window.clearTimeout(errorTimer);
      };
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x010204, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010204);

    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 80);
    camera.position.set(0, 0.2, 13.6);

    const pageGroup = new THREE.Group();
    pageGroup.position.set(0, -0.35, 0);
    scene.add(pageGroup);

    // 卡片 mesh:表单纹理由 ThreeHTMLRenderer 注入到 map,这里不预设贴图。
    const pageGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: 0xc5cad4,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      alphaTest: 0.005,
      side: THREE.FrontSide,
    });
    const pageMesh = new THREE.Mesh(pageGeometry, pageMaterial);
    pageGroup.add(pageMesh);

    const backingMaterial = new THREE.MeshStandardMaterial({
      color: 0x080a10,
      roughness: 0.9,
      metalness: 0.03,
    });
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(1.018, 1.028), backingMaterial);
    backing.position.z = -0.035;
    pageGroup.add(backing);

    const ambient = new THREE.HemisphereLight(0x71809b, 0x151118, 0.58);
    scene.add(ambient);

    const fillLight = new THREE.DirectionalLight(0x91a6c8, 0.24);
    fillLight.position.set(-4.8, 5.6, 7.4);
    scene.add(fillLight);

    const lampRoot = new THREE.Group();
    scene.add(lampRoot);

    const ceilingCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.3, 0.11, 24),
      new THREE.MeshStandardMaterial({ color: 0x101218, roughness: 0.64, metalness: 0.7 }),
    );
    ceilingCap.position.copy(anchor).add(new THREE.Vector3(0, 0.08, 0));
    scene.add(ceilingCap);

    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1, 10),
      new THREE.MeshStandardMaterial({ color: 0x121318, roughness: 0.5, metalness: 0.55 }),
    );
    scene.add(cable);

    const shadeGroup = new THREE.Group();
    lampRoot.add(shadeGroup);

    const shadeProfile = [
      new THREE.Vector2(0.08, 0.08),
      new THREE.Vector2(0.18, 0.02),
      new THREE.Vector2(0.43, -0.1),
      new THREE.Vector2(0.82, -0.25),
      new THREE.Vector2(1.08, -0.36),
      new THREE.Vector2(1.1, -0.41),
    ];
    const shadeMaterial = new THREE.MeshStandardMaterial({
      color: 0x101116,
      roughness: 0.36,
      metalness: 0.74,
      side: THREE.DoubleSide,
    });
    const shade = new THREE.Mesh(new THREE.LatheGeometry(shadeProfile, 48), shadeMaterial);
    shadeGroup.add(shade);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.095, 0.027, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x17191f, roughness: 0.28, metalness: 0.82 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.397;
    shadeGroup.add(rim);

    const undersideMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(INITIAL_LIGHT.color).multiplyScalar(0.18),
      emissive: INITIAL_LIGHT.color,
      emissiveIntensity: 0.42,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    const underside = new THREE.Mesh(new THREE.CircleGeometry(1.055, 48), undersideMaterial);
    underside.rotation.x = Math.PI / 2;
    underside.position.y = -0.385;
    shadeGroup.add(underside);

    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.12, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x9c6744, roughness: 0.44, metalness: 0.66 }),
    );
    connector.position.y = 0.08;
    shadeGroup.add(connector);

    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd7ad,
      emissive: INITIAL_LIGHT.color,
      emissiveIntensity: 3.2,
      roughness: 0.2,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), bulbMaterial);
    bulb.scale.y = 1.2;
    bulb.position.y = -0.33;
    shadeGroup.add(bulb);

    const glowTexture = createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: INITIAL_LIGHT.color,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.y = -0.36;
    glow.scale.set(0.96, 0.96, 0.96);
    shadeGroup.add(glow);

    const spot = new THREE.SpotLight(
      INITIAL_LIGHT.color,
      1,
      18,
      THREE.MathUtils.degToRad(INITIAL_LIGHT.angle),
      0.88,
      2,
    );
    spot.power = INITIAL_LIGHT.brightness;
    spot.position.set(0, -0.35, 0);
    spot.target.position.set(0, -7, 0);
    shadeGroup.add(spot, spot.target);

    const bulbLight = new THREE.PointLight(INITIAL_LIGHT.color, 1, 3.2, 2);
    bulbLight.power = 36;
    bulbLight.position.set(0, -0.35, 0);
    shadeGroup.add(bulbLight);

    lightRigRef.current = { spot, bulbLight, bulbMaterial, glowMaterial, undersideMaterial };

    // HTML-in-Canvas 集成:把表单 DOM 绘制到卡片 mesh 上。
    // connect 设置 canvas.onpaint 上传纹理;addObject 注册元素并在其上隔离指针事件;
    // 每帧 update() 重新把表单 matrix3d 定位到 mesh 屏幕投影 + requestPaint。
    const htmlRenderer = new ThreeHTMLRenderer();
    htmlRenderer.connect(canvas, camera, renderer);
    htmlRenderer.addObject(pageSource, pageMesh);

    function createGlowTexture() {
      const textureCanvas = document.createElement('canvas');
      textureCanvas.width = 64;
      textureCanvas.height = 64;
      const context = textureCanvas.getContext('2d');
      if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.16, 'rgba(255,222,172,.8)');
        gradient.addColorStop(0.46, 'rgba(255,170,94,.22)');
        gradient.addColorStop(1, 'rgba(255,140,70,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
      }
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, width < 760 ? 1.25 : 1.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const sourceWidth = pageSource.offsetWidth || 1280;
      const sourceHeight = pageSource.offsetHeight || 800;
      const portrait = height > width * 1.16;
      const pageWidth = portrait ? 7.2 : 12.8;
      const pageHeight = pageWidth * (sourceHeight / sourceWidth);
      pageMesh.scale.set(pageWidth, pageHeight, 1);
      backing.scale.set(pageWidth, pageHeight, 1);

      pageGroup.position.y = portrait ? -0.62 : -0.38;
      anchor.set(0, pageGroup.position.y + pageHeight / 2 + pageTopToAnchor, portrait ? 1.1 : 1.18);
      ceilingCap.position.copy(anchor);
      ceilingCap.position.y += 0.08;

      if (!pulling) {
        const constrained = temp.copy(position).sub(anchor);
        if (constrained.lengthSq() < 0.001) constrained.copy(DOWN);
        constrained.normalize().multiplyScalar(ropeLength);
        position.copy(anchor).add(constrained);
        previous.copy(position);
      }

      const fitHeight = pageHeight + 3.1;
      const fitWidth = pageWidth + 1.25;
      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const distanceForHeight = fitHeight / (2 * Math.tan(halfFov));
      const distanceForWidth = fitWidth / (2 * Math.tan(halfFov) * camera.aspect);
      const cameraDistance = Math.max(distanceForHeight, distanceForWidth);
      const cameraDrop = portrait ? 0.78 : 0.62;
      const upwardTarget = portrait ? -0.04 : 0.06;
      camera.position.set(0, pageGroup.position.y - cameraDrop, cameraDistance);
      camera.lookAt(0, pageGroup.position.y + upwardTarget, 0);
      camera.updateMatrixWorld();
      htmlRenderer.update();
      canvas.requestPaint?.();
      wake();
    }

    function updateRig() {
      ropeDirection.copy(position).sub(anchor).normalize();
      midpoint.copy(anchor).add(position).multiplyScalar(0.5);
      cable.position.copy(midpoint);
      cable.scale.set(1, ropeLength, 1);
      cableQuaternion.setFromUnitVectors(UP, ropeDirection);
      cable.quaternion.copy(cableQuaternion);

      if (pulling) {
        lightDirection.copy(aimTarget).sub(position).normalize();
        currentLightDirection.lerp(lightDirection, 0.32).normalize();
      } else {
        swingQuaternion.setFromUnitVectors(DOWN, ropeDirection);
        lightDirection.copy(BASE_LIGHT_DIRECTION).applyQuaternion(swingQuaternion).normalize();
        currentLightDirection.lerp(lightDirection, 0.14).normalize();
      }
      lampQuaternion.setFromUnitVectors(DOWN, currentLightDirection);
      lampRoot.position.copy(position);
      lampRoot.quaternion.copy(lampQuaternion);
    }

    function stepPhysics() {
      velocity.copy(position).sub(previous).multiplyScalar(pulling ? 0.985 : 0.9948);
      previous.copy(position);
      position.add(velocity).addScaledVector(gravity, fixedStep * fixedStep);

      if (pulling) {
        // 指针定义一个 3D 平衡方向,距离控制施加比例(像拉伸一根隐形弹簧)。
        tempB.copy(aimTarget).sub(anchor).normalize();
        tempB.lerp(DOWN, 1 - pullStrength * 0.82).normalize();
        tempC.copy(tempB).multiplyScalar(ropeLength).add(anchor).sub(position);
        temp.copy(position).sub(anchor).normalize();
        tempC.addScaledVector(temp, -tempC.dot(temp));
        position.addScaledVector(tempC, 52 * fixedStep * fixedStep);
      }

      temp.copy(position).sub(anchor);
      if (temp.lengthSq() < 1e-8) temp.copy(DOWN);
      temp.normalize().multiplyScalar(ropeLength);
      position.copy(anchor).add(temp);

      velocity.copy(position).sub(previous);
      if (pulling) {
        stableFrames = 0;
      } else if (velocity.lengthSq() < 0.000000014) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
    }

    function animate(time: number) {
      animationFrame = 0;
      if (disposed) return;

      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      accumulator = Math.min(accumulator + delta, fixedStep * 5);
      while (accumulator >= fixedStep) {
        stepPhysics();
        accumulator -= fixedStep;
      }

      updateRig();
      htmlRenderer.update();
      renderer.render(scene, camera);
      frame += 1;

      if (pulling || stableFrames < 80 || frame < 4) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    function wake() {
      stableFrames = 0;
      if (!animationFrame && !disposed) {
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(animate);
      }
    }

    wakeRef.current = wake;

    function pointerNdc(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }

    function updatePointerTarget(event: PointerEvent) {
      pointerNdc(event);
      if (!raycaster.ray.intersectPlane(interactionPlane, aimTarget)) return false;

      lampNdc.copy(position).project(camera);
      const distanceX = (pointer.x - lampNdc.x) * camera.aspect;
      const distanceY = pointer.y - lampNdc.y;
      const pointerDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      pullStrength = THREE.MathUtils.smoothstep(pointerDistance, 0.08, 1.15);
      return true;
    }

    function onPointerDown(event: PointerEvent) {
      // 监听挂在 window 上(polyfill 把表单搬到了 document.body 的 host div,
      // canvas 不一定是事件目标)。点在表单内(输入框/按钮等)时不拉灯,让控件正常工作。
      const target = event.target;
      if (target instanceof Element && target.closest('.sl-hl-source')) return;

      if (event.button === 2) {
        beamPointerId = event.pointerId;
        beamStartX = event.clientX;
        beamStartY = event.clientY;
        beamStartAngle = lightingRef.current.angle;
        beamDragged = false;
        pageSource.classList.add('is-adjusting-beam');
        return;
      }
      if (event.button !== 0 || beamPointerId !== -1) return;
      if (!updatePointerTarget(event)) return;

      pulling = true;
      pullPointerId = event.pointerId;
      lastPointerTime = performance.now();
      lastPointerTarget.copy(aimTarget);
      pointerVelocity.set(0, 0, 0);
      canvas.classList.add('is-pulling-light');
      wake();
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId === beamPointerId) {
        const movementX = event.clientX - beamStartX;
        const movementY = event.clientY - beamStartY;
        if (!beamDragged && Math.hypot(movementX, movementY) >= 4) beamDragged = true;
        if (beamDragged) {
          const nextAngle = THREE.MathUtils.clamp(
            Math.round(beamStartAngle + movementX * 0.14),
            16,
            58,
          );
          setLighting((current) =>
            current.angle === nextAngle ? current : { ...current, angle: nextAngle },
          );
          wake();
        }
        return;
      }
      if (!pulling || event.pointerId !== pullPointerId) return;
      if (!updatePointerTarget(event)) return;
      const now = performance.now();
      const elapsed = Math.max(0.008, Math.min(0.05, (now - lastPointerTime) / 1000));
      temp.copy(aimTarget).sub(lastPointerTarget).multiplyScalar(1 / elapsed);
      pointerVelocity.lerp(temp, 0.34);
      lastPointerTarget.copy(aimTarget);
      lastPointerTime = now;
      wake();
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId === beamPointerId) {
        const shouldCycleColor = !beamDragged && event.type !== 'pointercancel';
        beamPointerId = -1;
        beamDragged = false;
        pageSource.classList.remove('is-adjusting-beam');
        if (shouldCycleColor) {
          setLighting((current) => {
            const currentIndex = COLOR_PRESETS.findIndex(
              (color) => color === current.color.toLowerCase(),
            );
            const nextColor = COLOR_PRESETS[(currentIndex + 1) % COLOR_PRESETS.length];
            return { ...current, color: nextColor };
          });
        }
        wake();
        return;
      }
      if (!pulling || event.pointerId !== pullPointerId) return;

      // 保留当前运动,叠加指针动量,再加一点回弹脉冲;拉得越远,释放能量越大。
      velocity.copy(position).sub(previous).multiplyScalar(1 / fixedStep);
      temp.copy(position).sub(anchor).normalize();
      pointerVelocity.addScaledVector(temp, -pointerVelocity.dot(temp)).clampLength(0, 6);
      const pointerTransfer = THREE.MathUtils.lerp(0.055, 0.12, pullStrength);
      velocity.addScaledVector(pointerVelocity, pointerTransfer);

      tempB.copy(anchor).addScaledVector(DOWN, ropeLength).sub(position);
      tempB.addScaledVector(temp, -tempB.dot(temp));
      if (tempB.lengthSq() > 0.0001) {
        tempB.normalize();
        const returnImpulse = THREE.MathUtils.lerp(0.32, 1.6, pullStrength);
        velocity.addScaledVector(tempB, returnImpulse);
      }
      velocity.clampLength(0, 4.25);
      previous.copy(position).addScaledVector(velocity, -fixedStep);

      pulling = false;
      pullPointerId = -1;
      pullStrength = 0;
      canvas.classList.remove('is-pulling-light');
      wake();
    }

    function resetMotion() {
      pulling = false;
      pullPointerId = -1;
      pullStrength = 0;
      position.copy(anchor).addScaledVector(DOWN, ropeLength);
      previous.copy(position);
      pointerVelocity.set(0, 0, 0);
      currentLightDirection.copy(BASE_LIGHT_DIRECTION);
      canvas.classList.remove('is-pulling-light');
      beamPointerId = -1;
      beamDragged = false;
      pageSource.classList.remove('is-adjusting-beam');
      wake();
    }

    resetMotionRef.current = resetMotion;

    function onResize() {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    }

    function onPaint() {
      wake();
    }

    function onContextMenu(contextEvent: MouseEvent) {
      contextEvent.preventDefault();
    }

    canvas.addEventListener('dblclick', resetMotion);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', onResize, { passive: true });
    canvas.addEventListener('paint', onPaint);

    void document.fonts.ready.then(() => {
      if (disposed) return;
      canvas.requestPaint?.();
      resize();
      updateRig();
      setReady(true);
      wake();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('dblclick', resetMotion);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('paint', onPaint);
      // ThreeHTMLRenderer 没有 disconnect();清掉 overlay 对 canvas/camera 的引用即可,
      // 纹理由 WeakMap 持有,随 pageSource / pageMesh 一起回收。
      htmlRenderer.overlayRenderer.disconnect();
      wakeRef.current = null;
      resetMotionRef.current = null;
      lightRigRef.current = null;
      pageMaterial.map = null;
      pageMaterial.needsUpdate = true;
      pageGeometry.dispose();
      pageMaterial.dispose();
      backing.geometry.dispose();
      backingMaterial.dispose();
      shade.geometry.dispose();
      shadeMaterial.dispose();
      rim.geometry.dispose();
      (rim.material as THREE.Material).dispose();
      underside.geometry.dispose();
      undersideMaterial.dispose();
      connector.geometry.dispose();
      (connector.material as THREE.Material).dispose();
      bulb.geometry.dispose();
      bulbMaterial.dispose();
      cable.geometry.dispose();
      (cable.material as THREE.Material).dispose();
      ceilingCap.geometry.dispose();
      (ceilingCap.material as THREE.Material).dispose();
      glowTexture.dispose();
      glowMaterial.dispose();
      renderer.dispose();
    };
  }, [htmlCanvasReady]);

  // 3. 灯光状态 → 同步到 three.js 材质 / 光源。
  useEffect(() => {
    lightingRef.current = lighting;
    const rig = lightRigRef.current;
    if (!rig) return;

    const color = activeColorRef.current.set(lighting.color);
    const effectiveBrightness = lighting.enabled ? lighting.brightness : 0;
    rig.spot.color.copy(color);
    rig.spot.power = effectiveBrightness;
    rig.spot.angle = THREE.MathUtils.degToRad(lighting.angle);
    rig.bulbLight.color.copy(color);
    rig.bulbLight.power = lighting.enabled ? Math.max(18, lighting.brightness * 0.026) : 0;
    rig.bulbMaterial.emissive.copy(color);
    rig.bulbMaterial.emissiveIntensity = lighting.enabled ? 2.4 + lighting.brightness / 850 : 0.04;
    rig.glowMaterial.color.copy(color);
    rig.glowMaterial.opacity = lighting.enabled ? 0.52 + lighting.brightness / 4200 : 0;
    rig.undersideMaterial.color.copy(color).multiplyScalar(0.18);
    rig.undersideMaterial.emissive.copy(color);
    rig.undersideMaterial.emissiveIntensity = lighting.enabled
      ? 0.22 + lighting.brightness / 7250
      : 0.03;

    const canvas = canvasRef.current as HtmlCanvas | null;
    canvas?.requestPaint?.();
    wakeRef.current?.();
  }, [lighting]);

  function updateLighting(patch: Partial<LightingSettings>) {
    setLighting((current) => ({ ...current, ...patch }));
  }

  function resetLight() {
    setLighting(INITIAL_LIGHT);
    resetMotionRef.current?.();
  }

  return (
    <main
      className={`sl-hl-shell${ready ? ' is-ready' : ''}`}
      aria-label="Interactive HTML-in-Canvas light study"
      aria-busy={!ready && !error}
    >
      <canvas ref={canvasRef} className="sl-hl-canvas" aria-label="Interactive light study">
        {/* 表单是 canvas 的 layoutsubtree 子节点:真实 DOM、可输入,
            three-html-render 把它绘制成纹理贴到 3D 卡片上。 */}
        <GuestForm
          sourceRef={pageSourceRef}
          lighting={lighting}
          onLightingChange={updateLighting}
          onReset={resetLight}
        />
      </canvas>

      <GuestFormPreview hidden={ready || Boolean(error)} />
      <div className={`sl-hl-status-bar${ready || error ? ' is-hidden' : ''}`} aria-live="polite">
        <span /> PREPARING HTML SURFACE
      </div>
      {error ? <div className="sl-hl-error">{error}</div> : null}
    </main>
  );
}
