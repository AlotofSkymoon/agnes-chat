"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * WebGL 云层背景（fbm noise）。
 *
 * 用原生 WebGL 而不是 three.js —— three 有 600KB+，
 * 会显著拖慢构建并逼近 Workers 的 3MB 体积上限，而这里只需要一个全屏 fragment shader。
 *
 * ⚠️ 三个必须处理的现实问题：
 * 1. WebGL 可能不可用（老设备、禁用硬件加速、部分 iOS 环境）
 * 2. 动画很耗电，页面切到后台就该停
 * 3. 用户设置了"减少动态效果"时不应该动
 *
 * 任一情况都降级为静态渐变，绝不抛错、绝不白屏。
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

// 二维哈希
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 值噪声
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

  float t = u_time * 0.035;

  // 两层不同速度的云叠加，产生视差
  float n1 = fbm(p + vec2(t, t * 0.35));
  float n2 = fbm(p * 1.7 + vec2(-t * 0.6, t * 0.2) + n1 * 0.6);
  float cloud = mix(n1, n2, 0.45);

  // 顶部更亮，像有光从上方打下来
  float depth = pow(1.0 - uv.y, 1.35);

  vec3 deep = vec3(0.043, 0.055, 0.114);   // 近黑蓝
  vec3 mid = vec3(0.145, 0.129, 0.318);    // 紫
  vec3 glow = vec3(0.451, 0.318, 0.651);   // 亮紫

  vec3 col = mix(deep, mid, smoothstep(0.18, 0.72, cloud));
  col = mix(col, glow, smoothstep(0.62, 1.02, cloud) * 0.55);
  col += glow * depth * 0.16;

  // 轻微暗角，让中间更聚焦
  float vig = smoothstep(1.25, 0.28, length(uv - 0.5) * 1.6);
  col *= mix(0.82, 1.0, vig);

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
  /** null = 未确定；false = 确定不可用（降级）；true = 可用 */
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

    // 一个覆盖全屏的三角形对（两个三角形拼成矩形）
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

    // 静态模式：画一帧就停，之后只跟随尺寸变化重画
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
      {/* 降级层：始终在底层，WebGL 可用时被不透明画布盖住，不额外耗资源 */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,#3b2f66_0%,#1a1533_45%,#0b0a16_100%)]" />
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
