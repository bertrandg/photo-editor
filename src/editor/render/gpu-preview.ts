import { ADJUSTMENTS, type AdjustmentDef } from "../adjustments"

/**
 * Live preview of the adjustments on the GPU (WebGL 1, supported by virtually
 * every browser, old phones included). All the active adjustments run in a
 * single shader pass, generated from the `gpu` snippets of the registry, so a
 * slider update costs ~1–2 ms instead of tens or hundreds on the CPU.
 *
 * The export keeps using the CPU implementation (`process`), which has no
 * texture size limit.
 */

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  // Clip space y=+1 (top of the canvas) samples the first row of the texture.
  v_uv = vec2(a_pos.x + 1.0, 1.0 - a_pos.y) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const uniformName = (a: AdjustmentDef) => `u_${a.id.replace(/\W/g, "_")}`

/**
 * Builds the fragment shader. Adjustments are chained in registry order; each
 * kernel adjustment starts a new function so it can sample its neighbors
 * through everything that came before it.
 */
function buildFragment(active: AdjustmentDef[]) {
  const functions: string[] = []
  let body: string[] = ["vec3 c = texture2D(u_image, uv).rgb;"]
  let fn = 0

  for (const adj of active) {
    const block = `{ float v = ${uniformName(adj)}; ${adj.gpu!.glsl} } c = clamp(c, 0.0, 1.0);`
    if (adj.gpu!.kind === "kernel") {
      functions.push(`vec3 f${fn}(vec2 uv) {\n${body.join("\n")}\nreturn c;\n}`)
      fn++
      body = [
        `vec3 c = f${fn - 1}(uv);`,
        `#define src(o) f${fn - 1}(uv + (o) * u_texel)`,
        block,
        "#undef src",
      ]
    } else {
      body.push(block)
    }
  }
  functions.push(`vec3 f${fn}(vec2 uv) {\n${body.join("\n")}\nreturn c;\n}`)

  return `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_image;
uniform vec2 u_texel;
uniform float scale;
${active.map((a) => `uniform float ${uniformName(a)};`).join("\n")}
varying vec2 v_uv;
${functions.join("\n")}
void main() {
  gl_FragColor = vec4(f${fn}(v_uv), texture2D(u_image, v_uv).a);
}`
}

interface CompiledProgram {
  program: WebGLProgram
  uniforms: Map<string, WebGLUniformLocation | null>
}

export class GpuPreview {
  readonly canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private texture: WebGLTexture
  private programs = new Map<string, CompiledProgram>()
  private uploaded: { source: HTMLCanvasElement; width: number; height: number } | null = null
  private maxTextureSize: number
  private lost = false

  /** Returns `null` when WebGL is unavailable (the caller uses the CPU). */
  static create(): GpuPreview | null {
    try {
      return new GpuPreview()
    } catch {
      return null
    }
  }

  private constructor() {
    this.canvas = document.createElement("canvas")
    const gl = this.canvas.getContext("webgl", {
      // The result is copied to other canvases with drawImage.
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
    })
    if (!gl) throw new Error("WebGL indisponible")
    this.gl = gl
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    this.canvas.addEventListener("webglcontextlost", () => (this.lost = true))

    // Full screen quad.
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    this.texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    // NEAREST + CLAMP: exact pixels, same edge handling as the CPU kernels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private compile(active: AdjustmentDef[]): CompiledProgram {
    const key = active.map((a) => a.id).join(",")
    const cached = this.programs.get(key)
    if (cached) return cached

    const gl = this.gl
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader")
      return s
    }
    const program = gl.createProgram()!
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, buildFragment(active)))
    gl.bindAttribLocation(program, 0, "a_pos")
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link")

    const uniforms = new Map<string, WebGLUniformLocation | null>()
    for (const name of ["u_image", "u_texel", "scale", ...active.map(uniformName)]) {
      uniforms.set(name, gl.getUniformLocation(program, name))
    }
    const compiled = { program, uniforms }
    this.programs.set(key, compiled)
    return compiled
  }

  /**
   * Renders `source` with the adjustments into `this.canvas`.
   * Returns `false` when the GPU cannot handle it (the caller uses the CPU).
   */
  render(source: HTMLCanvasElement, values: Record<string, number>, scale: number): boolean {
    const gl = this.gl
    if (this.lost || gl.isContextLost()) return false
    if (source.width > this.maxTextureSize || source.height > this.maxTextureSize) return false

    const active = ADJUSTMENTS.filter((a) => (values[a.id] ?? a.default) !== a.default)
    if (active.some((a) => !a.gpu)) return false

    try {
      const { program, uniforms } = this.compile(active)

      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      const u = this.uploaded
      if (!u || u.source !== source || u.width !== source.width || u.height !== source.height) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
        this.uploaded = { source, width: source.width, height: source.height }
      }

      if (this.canvas.width !== source.width) this.canvas.width = source.width
      if (this.canvas.height !== source.height) this.canvas.height = source.height
      gl.viewport(0, 0, source.width, source.height)

      gl.useProgram(program)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1i(uniforms.get("u_image")!, 0)
      gl.uniform2f(uniforms.get("u_texel")!, 1 / source.width, 1 / source.height)
      gl.uniform1f(uniforms.get("scale")!, scale)
      for (const a of active) gl.uniform1f(uniforms.get(uniformName(a))!, values[a.id])

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return true
    } catch (err) {
      console.warn("Aperçu GPU indisponible, repli sur le CPU", err)
      this.lost = true
      return false
    }
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext()
    this.lost = true
  }
}
