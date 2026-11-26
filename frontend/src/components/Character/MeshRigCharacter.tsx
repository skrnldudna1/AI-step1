import { useEffect, useRef, useState } from 'react';
import type { CharacterRig, RigRegion } from '../../types/rig';
import type { CharacterReaction } from '../../types/character';
import type { VisualEmotion } from '../../types/emotion';
import { createRigMesh, deformRigMesh, meshMotion, neutralMeshPose } from './meshDeformation';
import type { ReferenceExpression } from './referenceExpression';

const PADDING = .065;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader unavailable');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('shader compilation failed'); }
  return shader;
}

function initialize(gl: WebGLRenderingContext, mesh: ReturnType<typeof createRigMesh>) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;
    void main() {
      vec2 padded = (a_position + ${PADDING.toFixed(3)}) / ${(1 + 2 * PADDING).toFixed(3)};
      gl_Position = vec4(padded.x * 2.0 - 1.0, 1.0 - padded.y * 2.0, 0.0, 1.0);
      v_uv = a_uv;
    }
  `);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_uv;
    void main() { gl_FragColor = texture2D(u_texture, v_uv); }
  `);
  const program = gl.createProgram();
  if (!program) throw new Error('program unavailable');
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('link failed'); }
  gl.useProgram(program);
  const buffer = (target: number, data: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>, usage: number) => {
    const value = gl.createBuffer();
    if (!value) throw new Error('buffer unavailable');
    gl.bindBuffer(target, value); gl.bufferData(target, data, usage); return value;
  };
  const positions = buffer(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
  const aPosition = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPosition); gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  const uv = buffer(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
  const aUV = gl.getAttribLocation(program, 'a_uv');
  gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
  const indices = buffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  const texture = gl.createTexture();
  if (!texture) throw new Error('texture unavailable');
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.clearColor(0, 0, 0, 0);
  return {
    upload(image: HTMLImageElement) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('texture upload failed');
    },
    draw(points: Float32Array<ArrayBuffer>) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions); gl.bufferSubData(gl.ARRAY_BUFFER, 0, points);
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteBuffer(positions); gl.deleteBuffer(uv); gl.deleteBuffer(indices); gl.deleteProgram(program); },
  };
}

type Props = { rig: CharacterRig; reaction: CharacterReaction; emotion: VisualEmotion; talking: boolean; reactionId: number; reference?: ReferenceExpression; active?: boolean; preserveExpression?: boolean };
const NO_REFERENCE: ReferenceExpression = {};

export default function MeshRigCharacter({ rig, reaction, emotion, talking, reactionId, reference = NO_REFERENCE, active = true, preserveExpression = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const state = useRef({ reaction, emotion, talking, reactionId, reference });
  useEffect(() => { state.current = { reaction, emotion, talking, reactionId, reference }; }, [reaction, emotion, talking, reactionId, reference]);
  const mesh = rig.mesh!;
  const aspect = rig.canvas.width / rig.canvas.height;
  const scale = Math.min(1, 720 / Math.max(rig.canvas.width, rig.canvas.height));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setReady(false);
    if (!active) return;
    // A registered expression is finished artwork. Animate its body/head
    // only, so uncertain facial detection cannot deform the actual drawing.
    const regions: RigRegion[] = preserveExpression ? mesh.regions.filter(region => !['left_eye','right_eye','left_eyebrow','right_eyebrow','mouth','nose'].includes(region.id)) : [...mesh.regions];
    if (!regions.some(region => region.id === 'head') && rig.headSplit !== undefined) {
      const y = Math.min(.94, Math.max(.12, rig.headSplit / 100));
      regions.push({ id: 'head', mode: 'region', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y }, { x: 0, y }], pivot: { x: .5, y } });
    }
    if (!regions.length) return;
    const geometry = createRigMesh(regions, aspect);
    if (!geometry.controls.length) return;
    const pos = new Float32Array(geometry.vertices.length);
    const poses = geometry.controls.map(neutralMeshPose);
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
    if (!gl) return;
    let renderer: ReturnType<typeof initialize>;
    try { renderer = initialize(gl, geometry); } catch { return; }
    const image = new Image();
    let disposed = false, frame = 0, last = 0, started = 0, prevReactionId = state.current.reactionId;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (time: number) => {
      if (disposed) return;
      if (!started || state.current.reactionId !== prevReactionId) { started = time; prevReactionId = state.current.reactionId; }
      const elapsed = (time - started) / 1000;
      if (!last || time - last >= 32) {
        const lerp = last ? 1 - Math.exp(-Math.min(time - last, 100) / 65) : 1;
        last = time;
        for (let i = 0; i < poses.length; i++) {
          const { emotion, reaction, talking, reference } = state.current;
          const target = meshMotion(geometry.controls[i], emotion, reaction, elapsed, talking, reduced.matches, reference[geometry.controls[i].region.id]);
          const pose = poses[i];
          for (const key of ['x', 'y', 'sx', 'sy', 'angle', 'smile'] as const) pose[key] += (target[key] - pose[key]) * lerp;
        }
        renderer.draw(deformRigMesh(geometry, poses, pos));
      }
      frame = requestAnimationFrame(draw);
    };
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); setReady(false); };
    canvas.addEventListener('webglcontextlost', lost);
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (disposed) return;
      try {
        renderer.upload(image); renderer.draw(geometry.vertices);
        setReady(true); frame = requestAnimationFrame(draw);
      } catch { setReady(false); }
    };
    image.src = mesh.src;
    return () => {
      disposed = true; cancelAnimationFrame(frame); image.onload = null;
      canvas.removeEventListener('webglcontextlost', lost); renderer.dispose();
    };
  }, [mesh.src, mesh.regions, aspect, rig.headSplit, active, preserveExpression]);

  return <>
    {!ready && <img className="rig-mesh-fallback" src={mesh.src} alt="" draggable={false} />}
    <canvas ref={canvasRef} className="rig-mesh-canvas" data-mesh-active={ready ? 'true' : undefined}
      width={Math.max(1, Math.round(rig.canvas.width * scale * (1 + PADDING * 2)))}
      height={Math.max(1, Math.round(rig.canvas.height * scale * (1 + PADDING * 2)))}
      style={{ display: ready ? 'block' : 'none' }} aria-hidden="true" />
  </>;
}
