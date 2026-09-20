"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * WebGL 云层背景（fbm noise）。
 *
 * 用原生 WebGL 而不是 three.js —— three 有 600KB+，
 * 会显著拖慢构建并逼近 Workers 的体积上限，而这里只需要一个全屏 fragment shader。
 *
 * 配色是**蓝天白云**（蔚蓝天空 + 白色云团），三层不同速度叠加产生视差，
 * 飘动速度调快了 —— 初版几乎看不出在动，像是张静止的图。
 *
 * ⚠️ 白云会飘到文字下面：亮云上的白字会糊成一片，
 * 所以赞助页的文字统一加了投影，见 globals.css 的 .on-sky。
 *
 * ⚠️ 三个必须处理的现实问题：
 * 1. WebGL 可能不可用（老设备、禁用硬件加速、部分 iOS 环境）
 * 2. 动画很耗电，页面切到后台就该停
 * 3. 用户设置了"减少动态效果"时不应该动
 *
 * 前两个都降级为**静态云团**而不是纯渐变 ——
 * 纯渐变等于"云不见了"，而这个组件存在的意义就是那层云。
 */

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 分形布朗运动：把噪声叠几层，才有云的层次感
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  // 修正宽高比，否则云会被拉扁
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 2.4;

  // 速度比之前快不少 —— 原先几乎看不出在动，像是张静止的图
  float t = u_time * 0.14;

  /*
   * 三层不同速度、不同缩放的云叠加，产生视差：
   * 近处的云走得快、远处的慢，才有"飘"的感觉而不是整块平移。
   */
  float n1 = fbm(p * 1.0 + vec2(t * 1.0, t * 0.18));
  float n2 = fbm(p * 1.8 + vec2(t * 0.62, -t * 0.12) + n1 * 0.5);
  float n3 = fbm(p * 3.1 + vec2(-t * 0.38, t * 0.08));
  float cloud = mix(mix(n1, n2, 0.45), n3, 0.22);

  /*
   * 云量：把噪声推成明显的团块（smoothstep 收窄过渡带），
   * 之前对比太弱，看起来只是颜色在缓慢变化，不像云。
   */
  float mass = smoothstep(0.34, 0.78, cloud);

  // 蓝天：顶部更深邃的蔚蓝，地平线附近偏浅
  vec3 skyTop = vec3(0.055, 0.290, 0.694);   // 深蔚蓝
  vec3 skyLow = vec3(0.478, 0.741, 0.953);   // 浅天蓝
  vec3 sky = mix(skyLow, skyTop, pow(1.0 - uv.y, 0.85));

  // 云：纯白，边缘带一点冷色阴影才不显得像贴纸
  vec3 cloudShadow = vec3(0.647, 0.769, 0.925);
  vec3 cloudLit = vec3(1.0, 1.0, 1.0);
  vec3 cloudCol = mix(cloudShadow, cloudLit, smoothstep(0.30, 0.72, cloud));

  // 阳光从上方来：云顶更亮
  cloudCol += vec3(0.10, 0.09, 0.05) * pow(1.0 - uv.y, 1.2);

  vec3 col = mix(sky, cloudCol, mass);

  // 轻微暗角，让中间更聚焦
  float vig = smoothstep(1.30, 0.30, length(uv - 0.5) * 1.6);
  col *= mix(0.84, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function CloudShader({
  className,
  /** 静态模式：只渲染一帧，不做动画（减少动态效果时自动启用） */
  paused = false,
}: {
  className?: string;
  paused?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  /** null = 未确定；false = 确定不可用（用 CSS 云兜底）；true = WebGL 云 */
  const [supported, setSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl", { antialias: false, alpha: false }) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      setSupported(false);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      setSupported(false);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setSupported(false);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    let raf = 0;
    const start = performance.now();

    function resize() {
      // 限制 dpr：高倍屏下 3x 会让像素填充量翻好几倍，帧率反而掉
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(canvas!.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas!.clientHeight * dpr));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
      gl!.viewport(0, 0, w, h);
      gl!.uniform2f(uRes, w, h);
    }

    function draw(now: number) {
      resize();
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }

    setSupported(true);

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (paused || reduce) {
      draw(performance.now());
      const onResize = () => draw(performance.now());
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    }

    let running = true;
    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // 切到后台就停 —— 否则一个看不见的页面还在满帧跑 shader
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [paused]);

  return (
    <div className={cn("relative isolate overflow-hidden", className)} aria-hidden>
      {/*
        CSS 云团兜底：始终在底层。
        WebGL 可用时被不透明画布盖住（不额外耗资源），
        不可用时它就是主角 —— 多层模糊光斑堆叠出云的层次，
        而不是退化成一片死板的渐变。
      */}
      <div className="cloud-fallback absolute inset-0" />
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-700",
          supported ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
