// three-html-render 0.1.x ↔ Three.js 的 texElementImage2D 重载桥接。
//
// 背景:HTML-in-Canvas 规范的 WebGL 扩展签名是
//   texElementImage2D(target, internalformat, element, config?)
// (3-4 参)。但 three.js 内部上传纹理走的是传统 texImage2D 风格的 6 参签名
//   (target, level, internalFormat, format, type, source)
// three-html-render 的 polyfill 在 WebGLRenderingContext.prototype 上挂的
// 是 3 参版本(length === 3),ThreeHTMLRenderer 调用时传 6 参会错位。
//
// 本函数仅在 polyfill 已安装时(__HTML_IN_CANVAS_POLYFILL__)把 3 参版本
// 重新包装成可吞 6 参的适配器,把多余参数按位置传给底层。原生实现不动。

export type HtmlCanvas = HTMLCanvasElement & {
  requestPaint?: () => void;
};

type HtmlCanvasWindow = Window & {
  __HTML_IN_CANVAS_POLYFILL__?: boolean;
};

type ElementTexturePrototype = {
  texElementImage2D?: (
    target: number,
    level: number,
    internalFormat: number,
    format: number,
    type: number,
    source: HTMLElement,
  ) => void;
};

/**
 * Bridges three-html-render 0.1.x to the short texElementImage2D overload used
 * by current Three.js releases. Native implementations remain untouched.
 */
export function installThreeHtmlTextureCompatibility() {
  if (!(window as HtmlCanvasWindow).__HTML_IN_CANVAS_POLYFILL__) return;

  const contextConstructors = [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext];
  for (const contextConstructor of contextConstructors) {
    if (!contextConstructor) continue;
    const prototype = contextConstructor.prototype as ElementTexturePrototype;
    const uploadElement = prototype.texElementImage2D;
    // 只在 polyfill 注入了 3 参版本时才适配;原生 6 参版本不动。
    if (!uploadElement || uploadElement.length !== 3) continue;

    Object.defineProperty(prototype, 'texElementImage2D', {
      configurable: true,
      writable: true,
      value: function texElementImage2D(
        this: WebGLRenderingContext | WebGL2RenderingContext,
        target: number,
        level: number,
        internalFormat: number,
        format: number,
        type: number,
        source: HTMLElement,
      ) {
        uploadElement.call(this, target, level, internalFormat, format, type, source);
      },
    });
  }
}
