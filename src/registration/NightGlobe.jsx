'use client';
import { useEffect, useRef, useState } from 'react';

// The earth at night behind /councils/ (office, 10 Nov): NASA's Black Marble
// map of the city lights (public domain; 4096×2048, from the three-globe
// examples) wrapped round a real sphere and drawn by the graphics chip at the
// screen's full sharpness. It turns once every four minutes, the city lights
// are lifted and breathe gently, and a thin blue atmosphere glows at the edge.
// Still (one frame) for reduced motion; the old flat picture if WebGL is
// unavailable.
const VERTEX = `attribute vec2 p; varying vec2 uv; void main(){ uv = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAGMENT = `precision highp float;
varying vec2 uv;
uniform sampler2D map;
uniform float spin, pulse, aspect;
const float PI = 3.14159265;
void main(){
  vec2 q = uv * vec2(aspect, 1.0) / 0.86;
  float r2 = dot(q, q);
  if (r2 > 1.0) {
    float d = sqrt(r2) - 1.0;
    float halo = exp(-d * 9.0) * 0.55;
    gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * halo, halo);
    return;
  }
  vec3 n = vec3(q, sqrt(1.0 - r2));
  float tilt = 0.32;
  n = vec3(n.x, n.y * cos(tilt) - n.z * sin(tilt), n.y * sin(tilt) + n.z * cos(tilt));
  float lon = atan(n.x, n.z) + spin;
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 t = vec2(fract(lon / (2.0 * PI) + 0.5), 0.5 - lat / PI);
  vec3 c = texture2D(map, t).rgb;
  // City lights: the warm pixels of the map, lifted well above the land and
  // breathing slowly, with a soft bloom from the neighbouring texels.
  vec2 px = vec2(1.0 / 4096.0, 1.0 / 2048.0) * 2.0;
  vec3 near = (texture2D(map, t + vec2(px.x, 0.0)).rgb + texture2D(map, t - vec2(px.x, 0.0)).rgb + texture2D(map, t + vec2(0.0, px.y)).rgb + texture2D(map, t - vec2(0.0, px.y)).rgb) * 0.25;
  float warm = smoothstep(0.05, 0.32, c.r - c.b * 0.6);
  float bloom = smoothstep(0.04, 0.28, near.r - near.b * 0.6);
  vec3 lights = vec3(1.0, 0.76, 0.38) * (warm * (2.8 + 1.0 * pulse) + bloom * (0.9 + 0.5 * pulse));
  float limb = mix(0.4, 1.0, pow(n.z, 0.6));
  vec3 col = c * 1.45 * limb + lights * mix(0.55, 1.0, n.z);
  float rim = pow(1.0 - sqrt(1.0 - r2), 2.5);
  col += vec3(0.25, 0.55, 1.0) * rim * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

export default function NightGlobe({ src, fallback }) {
  const canvas = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl || gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) { setFailed(true); return; }
    const shader = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { setFailed(true); return; }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    const u = name => gl.getUniformLocation(program, name);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0, ready = false, last = 0, gone = false;
    const size = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const { width, height } = el.getBoundingClientRect();
      el.width = Math.round(width * ratio); el.height = Math.round(height * ratio);
      gl.viewport(0, 0, el.width, el.height);
    };
    const draw = now => {
      if (gone) return;
      // About 30 frames a second is plenty for a slow turn.
      if (!still) frame = requestAnimationFrame(draw);
      if (!ready || (!still && now - last < 33)) return;
      last = now;
      const seconds = now / 1000;
      gl.uniform1f(u('spin'), still ? 0.4 : 0.4 + seconds * (2 * Math.PI / 240));
      gl.uniform1f(u('pulse'), still ? 0.5 : 0.5 + 0.5 * Math.sin(seconds * 1.3));
      gl.uniform1f(u('aspect'), el.width / el.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (gone) return;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(u('map'), 0);
      ready = true; el.classList.add('is-ready');
      draw(performance.now());
    };
    image.onerror = () => setFailed(true);
    image.src = src;
    size(); addEventListener('resize', size);
    if (!still) frame = requestAnimationFrame(draw);
    return () => { gone = true; cancelAnimationFrame(frame); removeEventListener('resize', size); };
  }, [src]);
  return failed ? <img className="tx-globe-fallback" src={fallback} alt=""/> : <canvas ref={canvas} className="tx-globe"/>;
}
