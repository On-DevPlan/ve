import * as THREE from 'three';

// 原始曲线(不要改)
const originalCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, -4),
  new THREE.Vector3(1.5, -0.3, -1),
  new THREE.Vector3(-1, 0.2, 2),
  new THREE.Vector3(0.5, -0.5, 5),
  new THREE.Vector3(0.99, -0.19, -0.15),
]);

// 从原曲线的 0% ~ 32% 精确采样 20 个点
const SAMPLE_COUNT = 20;
const END_T = 0.32;
const sampledPoints: THREE.Vector3[] = [];
for (let i = 0; i <= SAMPLE_COUNT; i++) {
  const t = (i / SAMPLE_COUNT) * END_T;
  sampledPoints.push(originalCurve.getPoint(t));
}

// 用采样点构建新曲线(完美还原原始形状)
const truncatedCurve = new THREE.CatmullRomCurve3(sampledPoints);

export function createCurvePath() {
  return {
    getPosition(t: number): THREE.Vector3 {
      return truncatedCurve.getPoint(t);
    },
    getLookAt(t: number): THREE.Vector3 {
      // 映射回原曲线的 t 范围 [0, 0.32]
      const originalT = t * END_T;
      // 在原曲线上往前看一小段
      const lookT = Math.min(originalT + 0.05, 0.37);
      return originalCurve.getPoint(lookT);
    },
  };
}

export const defaultPath = createCurvePath();
