declare module '@mkkellogg/gaussian-splats-3d' {
  import type * as THREE from 'three';

  interface ViewerOptions {
    selfDrivenMode: boolean;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    useBuiltInControls: boolean;
    sharedMemoryForWorkers: boolean;
  }

  interface SplatSceneOptions {
    splatAlphaRemovalThreshold: number;
    showLoadingUI: boolean;
    position: [number, number, number];
    rotation: [number, number, number, number];
  }

  export class Viewer {
    constructor(options: ViewerOptions);
    addSplatScene(path: string, options: SplatSceneOptions): Promise<void>;
    update(): void;
    render(): void;
    dispose?: () => void;
  }
}
