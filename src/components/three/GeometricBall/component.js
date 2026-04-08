export default {
  name: 'GeometricBall',
  title: '几何球体',
  description: 'Three.js IcosahedronGeometry 几何球体，顶点着色，金属质感，RoomEnvironment 光照',
  version: '1.0.0',
  group: 'Three.js',
  category: '3D Shapes',
  tags: ['threejs', '3d', 'geometry', 'icosahedron', 'vertex-color'],
  component: './index.vue',
  route: {
    meta: {
      title: '几何球体',
      icon: '🔮'
    }
  },
  fullscreen: true,
  dependencies: ['three']
}
