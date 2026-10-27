import { advanceGlassFluid, newGlassFluidState, type FluidFrame } from "./glass-cleaning";

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * .5 + .5;
  gl_Position = vec4(a_position, 0., 1.);
}`;

// Height-field normals give the gathered liquid depth and specular reflections.
// The street is sampled through those normals for actual image refraction.
const fragmentSource = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_view;
uniform vec4 u_blade;
uniform vec4 u_params;
uniform vec4 u_photo;
uniform vec4 u_drops[8];
uniform sampler2D u_scene;
uniform sampler2D u_foam;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x),
    mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
}
vec2 bladePoint(vec2 p) {
  vec2 d = p - u_blade.xy;
  return vec2(dot(d, vec2(.91354546, -.40673664)), dot(d, vec2(.40673664, .91354546)));
}
float bank(vec2 p) {
  vec2 b = bladePoint(p);
  float ends = 1. - smoothstep(u_blade.z * .5 - 5., u_blade.z * .5 + 2., abs(b.x));
  float uneven = noise(vec2(b.x * .07, u_params.w * .10)) * 4.;
  float thickness = 3. + u_params.x * 4. + uneven * .5;
  // The foam bank straddles the rubber, covering its black contact face.
  return exp(-pow((b.y - 9. - uneven) / thickness, 2.)) * ends;
}
float heightAt(vec2 p) {
  float h = bank(p);
  for (int i = 0; i < 8; i++) {
    vec4 drop = u_drops[i];
    if (drop.z > .1) {
      vec2 d = (p - drop.xy) / vec2(drop.z, drop.z * drop.w);
      h += pow(max(0., 1. - dot(d, d)), 1.5) * .65;
    }
  }
  return h;
}
void main() {
  vec2 p = vec2(v_uv.x, 1. - v_uv.y) * u_view;
  float h = heightAt(p);
  if (h < .012 || u_params.z < .01) { gl_FragColor = vec4(0.); return; }
  vec3 normal = normalize(vec3((heightAt(p - vec2(1.,0.)) - heightAt(p + vec2(1.,0.))) * 4.,
    (heightAt(p - vec2(0.,1.)) - heightAt(p + vec2(0.,1.))) * 4., 1.));
  vec2 refractUV = (p - normal.xy * 7. - u_photo.xy) / u_photo.zw;
  vec3 street = texture2D(u_scene, clamp(refractUV, .001, .999)).rgb;
  vec2 b = bladePoint(p);
  vec4 texture = texture2D(u_foam, vec2(b.x / max(u_blade.z,1.) + .5, .45 + b.y / 100.));
  float micro = noise(p * 1.7);
  float diffuse = max(0., dot(normal, normalize(vec3(-.4,-.6,1.))));
  float shine = pow(max(0., dot(normal, normalize(vec3(-.35,-.55,1.)))), 24.);
  vec3 water = street * (.84 + .12 * diffuse) + vec3(shine * .65);
  vec3 soap = vec3(.91,.94,.91) * (.60 + diffuse * .36);
  soap += (micro - .5) * .09 + texture.rgb * texture.a * .025 + shine * .08;
  float foam = smoothstep(.08,.65,bank(p));
  float alpha = smoothstep(.012,.10,h) * mix(.38,.97,foam) * u_params.z;
  gl_FragColor = vec4(mix(water, soap, foam), alpha);
}`;

export function createGlassFluid(
  canvas: HTMLCanvasElement,
  sceneImage: HTMLImageElement,
  foamImage: HTMLImageElement,
) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false });
  if (!gl) { canvas.dataset.renderer = "fallback"; return null; }
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
    canvas.dataset.renderer = "fallback";
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    canvas.dataset.renderer = "fallback";
    return null;
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(["view", "blade", "params", "photo", "drops[0]", "scene", "foam"].map((key) => [key, gl.getUniformLocation(program, `u_${key}`)]));
  const textures: WebGLTexture[] = [];
  const textureCleanups: (() => void)[] = [];
  [sceneImage, foamImage].forEach((image, index) => {
    const texture = gl.createTexture();
    if (!texture) return;
    textures.push(texture);
    const upload = () => {
      if (!image.complete || !image.naturalWidth || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([240,245,239,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uniforms[index ? "foam" : "scene"], index);
    image.addEventListener("load", upload);
    textureCleanups.push(() => image.removeEventListener("load", upload));
    upload();
  });
  const state = newGlassFluidState();
  const dropValues = new Float32Array(32);
  let frame: FluidFrame | null = null;
  let active = false;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  canvas.dataset.renderer = "webgl";

  const draw = (time: number, force = false) => {
    raf = 0;
    if (disposed || !active || !frame || gl.isContextLost()) return;
    if (!force && last && time - last < 30) { raf = requestAnimationFrame(draw); return; }
    const dt = last ? Math.min((time - last) / 1000, .05) : 0;
    last = time;
    elapsed += dt;
    const stroke = advanceGlassFluid(state, frame, dt);
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, 1100 / Math.max(frame.width,1), 760 / Math.max(frame.height,1));
    const width = Math.max(1, Math.round(frame.width * scale));
    const height = Math.max(1, Math.round(frame.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    dropValues.fill(0);
    state.drops.forEach((drop, index) => dropValues.set([drop.x, drop.y, drop.radius, 1 + Math.min(1.8, drop.velocity / 210)], index * 4));
    gl.uniform2f(uniforms.view, frame.width, frame.height);
    gl.uniform4f(uniforms.blade, stroke.x, stroke.y, stroke.blade, 0);
    gl.uniform4f(uniforms.params, state.collected, frame.progress, Math.min(1, (1 - frame.progress) / .10), elapsed);
    gl.uniform4f(uniforms.photo, frame.pane.imageLeft, frame.pane.imageTop, frame.pane.imageWidth, frame.pane.imageHeight);
    gl.uniform4fv(uniforms["drops[0]"], dropValues);
    // Only shade the narrow moving blade/liquid bounding box, not an entire
    // full-screen buffer of transparent pixels (important on software GPUs).
    const halfX = stroke.blade * .457 + 28;
    const halfY = stroke.blade * .204 + 28;
    let left = stroke.x - halfX, right = stroke.x + halfX;
    let top = stroke.y - halfY, bottom = stroke.y + halfY;
    for (const drop of state.drops) {
      left = Math.min(left, drop.x - 10); right = Math.max(right, drop.x + 10);
      top = Math.min(top, drop.y - 12); bottom = Math.max(bottom, drop.y + 12);
    }
    left = Math.max(0, Math.floor(left * scale));
    right = Math.min(width, Math.ceil(right * scale));
    top = Math.max(0, Math.floor(top * scale));
    bottom = Math.min(height, Math.ceil(bottom * scale));
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(left, height - bottom, Math.max(0, right - left), Math.max(0, bottom - top));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
    canvas.dataset.droplets = String(state.drops.length);
    canvas.dataset.collected = state.collected.toFixed(3);
    canvas.dataset.progress = frame.progress.toFixed(4);
    raf = requestAnimationFrame(draw);
  };
  const setFrame = (next: FluidFrame, visible: boolean) => {
    const moved = !frame || Math.abs(frame.progress - next.progress) > .00001 || frame.width !== next.width || frame.height !== next.height;
    if (frame && (frame.width !== next.width || frame.height !== next.height)) {
      state.drops.length = 0; state.travel = 0; state.progress = null;
    }
    frame = next;
    active = visible;
    if (!active) { cancelAnimationFrame(raf); raf = 0; last = 0; }
    else if (moved && !disposed) {
      // Commit the foam bank in the same frame as the DOM rubber edge. It must
      // not trail one throttled physics frame behind during a quick wheel pull.
      cancelAnimationFrame(raf);
      draw(performance.now(), true);
    } else if (!raf && !disposed) raf = requestAnimationFrame(draw);
  };
  const contextLost = (event: Event) => {
    event.preventDefault(); active = false;
    cancelAnimationFrame(raf);
    canvas.dataset.renderer = "fallback";
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  return {
    setFrame,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", contextLost);
      textureCleanups.forEach((cleanup) => cleanup());
      textures.forEach((texture) => gl.deleteTexture(texture));
      if (buffer) gl.deleteBuffer(buffer);
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
    },
  };
}
