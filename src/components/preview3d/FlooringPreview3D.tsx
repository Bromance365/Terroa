"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type * as THREE_NS from "three";
import { getProduct, imgSrc, productName } from "@/lib/catalog";
import type { Locale } from "@/i18n/routing";
import { buildScene, EYE_HEIGHT_FT, fitCamera, interiorOrbit, type PreviewRoom, type PreviewScene } from "@/lib/preview3d/build";
import { cx } from "@/components/ui/cx";

type Mode = "top" | "interior";
type Status = "loading" | "ready" | "unsupported" | "lost";
type Three = typeof THREE_NS;

export interface FlooringPreview3DLabels {
  title: string;
  orbitHint: string;
  interior: string;
  topView: string;
  unsupported: string;
  loading: string;
  reset: string;
  /** Short note shown under the canvas (for example: walls are indicative). */
  legend?: string;
  /** Text-alternative wording for a room without a chosen product. */
  noFlooring?: string;
}

export interface FlooringPreview3DProps {
  rooms: PreviewRoom[];
  wallHeightFt?: number;
  className?: string;
  labels: FlooringPreview3DLabels;
  onReady?: () => void;
}

interface Engine {
  setMode(m: Mode): void;
  reset(): void;
  rotate(dAzimuth: number, dPolar: number): void;
  zoom(factor: number): void;
  setTitle(t: string): void;
  dispose(): void;
}

const MAX_DPR = 2;
const KEY_STEP = 0.12;

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Reads a CSS custom property as a three.js colour; falls back to a neutral grey if unreadable. */
function tokenColor(THREE: Three, el: Element, name: string): THREE_NS.Color {
  const color = new THREE.Color(0.8, 0.8, 0.8);
  try {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if (v) color.set(v);
  } catch {
    /* keep fallback */
  }
  return color;
}

function loadSwatch(THREE: Three, url: string, maxAniso: number): Promise<THREE_NS.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        // SVG swatches may report no intrinsic size: draw into a fixed-size canvas.
        const size = 512;
        const cv = document.createElement("canvas");
        cv.width = size;
        cv.height = size;
        const ctx = cv.getContext("2d");
        if (!ctx) throw new Error("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = Math.min(8, maxAniso);
        resolve(tex);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("swatch"));
    img.src = url;
  });
}

async function createEngine(opts: {
  host: HTMLElement;
  scene: PreviewScene;
  title: string;
  getMode: () => Mode;
  onStatus: (s: Status) => void;
  isCancelled: () => boolean;
}): Promise<Engine | null> {
  const { host, scene: plan } = opts;
  if (!webglAvailable()) {
    opts.onStatus("unsupported");
    return null;
  }
  const [THREE, { OrbitControls }] = await Promise.all([import("three"), import("three/examples/jsm/controls/OrbitControls.js")]);
  if (opts.isCancelled()) return null;

  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", opts.title);
  canvas.className = "block h-full w-full touch-none rounded-[inherit] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  host.appendChild(canvas);

  let renderer: THREE_NS.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "default" });
  } catch {
    canvas.remove();
    opts.onStatus("unsupported");
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.shadowMap.enabled = false;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Colours come from design tokens (CSS variables), never from literals.
  const cSurface = tokenColor(THREE, host, "--surface");
  const cFloor = tokenColor(THREE, host, "--line");
  const cWall = tokenColor(THREE, host, "--surface-raised");
  const cPanel = tokenColor(THREE, host, "--ink-muted");
  renderer.setClearColor(cSurface, 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(cWall, cFloor, 0.9));
  const sun = new THREE.DirectionalLight(cWall, 0.45);
  sun.position.set(plan.bounds.cx + 20, 40, plan.bounds.cz + 12);
  scene.add(sun);

  const geometries: THREE_NS.BufferGeometry[] = [];
  const materials: THREE_NS.Material[] = [];
  const textures = new Map<string, THREE_NS.CanvasTexture>();
  const pending = new Map<string, THREE_NS.MeshLambertMaterial[]>();
  const track = <T extends THREE_NS.BufferGeometry | THREE_NS.Material>(o: T, list: T[]) => {
    list.push(o);
    return o;
  };

  let disposed = false;
  let raf = 0;
  let visible = true;
  let dirty = true;

  const render = () => {
    raf = 0;
    if (disposed || !visible || !dirty) return;
    dirty = false;
    renderer.render(scene, activeCamera());
  };
  const requestRender = () => {
    dirty = true;
    if (!raf && !disposed && visible) raf = requestAnimationFrame(render);
  };

  // Floors
  const wallMat = track(new THREE.MeshLambertMaterial({ color: cWall }), materials) as THREE_NS.MeshLambertMaterial;
  const productMaterials = (productId: string | null, fallback: THREE_NS.Color, tileFt: number, isPanel = false): THREE_NS.MeshLambertMaterial => {
    const mat = track(new THREE.MeshLambertMaterial({ color: fallback }), materials) as THREE_NS.MeshLambertMaterial;
    const product = productId ? getProduct(productId) : undefined;
    if (product) {
      const url = imgSrc(product.image);
      const list = pending.get(url) ?? [];
      list.push(mat);
      pending.set(url, list);
      (mat.userData as { tileFt?: number; isPanel?: boolean }).tileFt = tileFt;
      (mat.userData as { isPanel?: boolean }).isPanel = isPanel;
    }
    return mat;
  };

  for (const f of plan.floors) {
    const g = track(new THREE.BufferGeometry(), geometries);
    g.setAttribute("position", new THREE.Float32BufferAttribute(f.positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(f.uvs, 2));
    g.setIndex(f.indices);
    g.computeVertexNormals();
    const product = f.productId ? getProduct(f.productId) : undefined;
    const isFloorProduct = product?.kind === "floor";
    const mat = isFloorProduct ? productMaterials(f.productId, cFloor, f.tileFt) : (track(new THREE.MeshLambertMaterial({ color: cFloor }), materials) as THREE_NS.MeshLambertMaterial);
    scene.add(new THREE.Mesh(g, mat));
  }

  // Walls (indicative: no openings)
  const wallGeo = new Map<string, THREE_NS.BoxGeometry>();
  for (const w of plan.walls) {
    const key = `${w.length.toFixed(3)}|${w.height}|${w.thickness}`;
    let g = wallGeo.get(key);
    if (!g) {
      g = track(new THREE.BoxGeometry(w.length, w.height, w.thickness), geometries) as THREE_NS.BoxGeometry;
      wallGeo.set(key, g);
    }
    const m = new THREE.Mesh(g, wallMat);
    m.position.set(w.cx, w.height / 2, w.cz);
    m.rotation.y = w.rotationY;
    scene.add(m);
  }

  // Slat panels on the longest wall
  for (const p of plan.panels) {
    const g = track(new THREE.BoxGeometry(p.width, p.height, p.depth), geometries);
    const mat = productMaterials(p.productId, cPanel, p.tileFt, true);
    const inst = new THREE.InstancedMesh(g, mat, p.slats.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY);
    const one = new THREE.Vector3(1, 1, 1);
    p.slats.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, p.cy, s.z), q, one);
      inst.setMatrixAt(i, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }

  // Textures load after the first render; materials fall back to the token colour on failure.
  pending.forEach((mats, url) => {
    loadSwatch(THREE, url, maxAniso)
      .then((base) => {
        if (disposed) {
          base.dispose();
          return;
        }
        textures.set(url, base);
        for (const mat of mats) {
          const tileFt = (mat.userData as { tileFt?: number }).tileFt ?? 4;
          // Floor UVs are already in tile units (feet / tileFt); slats use box UVs, scaled by tile size.
          const t = base.clone();
          t.needsUpdate = true;
          if ((mat.userData as { isPanel?: boolean }).isPanel) t.repeat.set(1, Math.max(1, Math.round(plan.wallHeightFt / tileFt)));
          textures.set(`${url}#${textures.size}`, t);
          mat.map = t;
          mat.color.set(cWall);
          mat.needsUpdate = true;
        }
        requestRender();
      })
      .catch(() => {
        /* keep the token colour */
      });
  });

  // Cameras and controls
  const persp = new THREE.PerspectiveCamera(50, 1.6, 0.1, 500);
  const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 300);
  let mode: Mode = opts.getMode();
  let controls: InstanceType<typeof OrbitControls> | null = null;
  function activeCamera(): THREE_NS.Camera {
    return mode === "top" ? ortho : persp;
  }
  let aspect = 1.6;

  const frameOrtho = () => {
    const fit = fitCamera(plan.bounds, aspect, 45);
    const h = fit.orthoHalfHeight;
    ortho.left = -h * aspect;
    ortho.right = h * aspect;
    ortho.top = h;
    ortho.bottom = -h;
    ortho.updateProjectionMatrix();
  };

  const applyMode = (m: Mode) => {
    mode = m;
    controls?.dispose();
    const cam = activeCamera();
    controls = new OrbitControls(cam, canvas);
    controls.enableDamping = false; // no easing: render only on real input
    controls.enablePan = false;
    controls.addEventListener("change", requestRender);
    if (m === "top") {
      frameOrtho();
      ortho.zoom = 1;
      ortho.updateProjectionMatrix();
      controls.target.set(plan.bounds.cx, 0, plan.bounds.cz);
      // Polar angle held near 0 gives a straight-down view with plan "up" at the top of the screen.
      controls.minPolarAngle = 0.001;
      controls.maxPolarAngle = 0.001;
      controls.minZoom = 0.5;
      controls.maxZoom = 6;
      ortho.position.set(plan.bounds.cx, 120, plan.bounds.cz + 0.12);
    } else {
      const o = interiorOrbit(plan);
      controls.target.set(o.target.x, o.target.y, o.target.z);
      controls.minPolarAngle = 0.5;
      controls.maxPolarAngle = Math.PI / 2 + 0.25;
      controls.minDistance = o.minDistance;
      controls.maxDistance = o.maxDistance;
      persp.position.set(o.target.x, EYE_HEIGHT_FT, o.target.z + o.radius);
    }
    cam.lookAt(controls.target);
    controls.update();
    requestRender();
  };

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    aspect = w / h;
    renderer.setSize(w, h, false);
    persp.aspect = aspect;
    persp.updateProjectionMatrix();
    const z = ortho.zoom;
    frameOrtho();
    ortho.zoom = z;
    ortho.updateProjectionMatrix();
    requestRender();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting) && !document.hidden;
    if (visible) requestRender();
  });
  io.observe(host);
  const onVis = () => {
    visible = !document.hidden;
    if (visible) requestRender();
  };
  document.addEventListener("visibilitychange", onVis);

  const onLost = (e: Event) => {
    e.preventDefault();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    opts.onStatus("lost");
  };
  const onRestored = () => {
    opts.onStatus("ready");
    requestRender();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const rotate = (dAz: number, dPolar: number) => {
    if (!controls) return;
    const cam = activeCamera();
    const off = new THREE.Vector3().subVectors(cam.position, controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz;
    sph.phi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, sph.phi + dPolar));
    off.setFromSpherical(sph);
    cam.position.copy(controls.target).add(off);
    cam.lookAt(controls.target);
    controls.update();
    requestRender();
  };
  const zoom = (factor: number) => {
    if (!controls) return;
    if (mode === "top") {
      ortho.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, ortho.zoom * factor));
      ortho.updateProjectionMatrix();
    } else {
      const off = new THREE.Vector3().subVectors(persp.position, controls.target);
      const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length() / factor));
      persp.position.copy(controls.target).add(off.setLength(len));
    }
    controls.update();
    requestRender();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
        rotate(-KEY_STEP, 0);
        break;
      case "ArrowRight":
        rotate(KEY_STEP, 0);
        break;
      case "ArrowUp":
        rotate(0, -KEY_STEP);
        break;
      case "ArrowDown":
        rotate(0, KEY_STEP);
        break;
      case "+":
      case "=":
        zoom(1.2);
        break;
      case "-":
      case "_":
        zoom(1 / 1.2);
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };
  canvas.addEventListener("keydown", onKey);

  resize();
  applyMode(mode);
  opts.onStatus("ready");

  return {
    setMode: (m) => {
      if (m !== mode) applyMode(m);
    },
    reset: () => applyMode(mode),
    rotate,
    zoom,
    setTitle: (t) => canvas.setAttribute("aria-label", t),
    dispose: () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      canvas.removeEventListener("keydown", onKey);
      controls?.removeEventListener("change", requestRender);
      controls?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

const btn =
  "inline-flex min-h-[44px] items-center justify-center rounded-md border px-4 text-[16px] font-semibold leading-6 select-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Reusable 3D flooring preview: floors textured with product swatches, indicative walls
 * (no openings), a top view and an eye-level interior view. three.js loads on demand.
 * The room list below the canvas is the text alternative.
 */
export function FlooringPreview3D({ rooms, wallHeightFt, className, labels, onReady }: FlooringPreview3DProps) {
  const locale = useLocale() as Locale;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [mode, setMode] = useState<Mode>("top");
  const modeRef = useRef<Mode>("top");
  const [status, setStatus] = useState<Status>("loading");
  const onReadyRef = useRef(onReady);
  const titleRef = useRef(labels.title);
  const hintId = useId();

  useEffect(() => {
    onReadyRef.current = onReady;
    titleRef.current = labels.title;
    engineRef.current?.setTitle(labels.title);
  });

  // Rooms are compared by value so a new array with the same content does not rebuild the scene.
  const roomsKey = JSON.stringify(rooms);
  const plan = useMemo(
    () =>
      buildScene(JSON.parse(roomsKey) as PreviewRoom[], {
        wallHeightFt,
        productInfo: (id) => {
          const p = getProduct(id);
          return p ? { kind: p.kind, format: p.format } : null;
        },
      }),
    [roomsKey, wallHeightFt],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: Engine | null = null;
    setStatus("loading");
    createEngine({
      host,
      scene: plan,
      title: titleRef.current,
      getMode: () => modeRef.current,
      onStatus: (s) => {
        if (!cancelled) {
          setStatus(s);
          if (s === "ready") onReadyRef.current?.();
        }
      },
      isCancelled: () => cancelled,
    })
      .then((e) => {
        if (!e) return;
        if (cancelled) e.dispose();
        else {
          engine = e;
          engineRef.current = e;
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });
    return () => {
      cancelled = true;
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [plan]);

  const choose = (m: Mode) => {
    modeRef.current = m;
    setMode(m);
    engineRef.current?.setMode(m);
  };

  const flooringName = (r: PreviewRoom) => {
    const p = r.productId ? getProduct(r.productId) : undefined;
    return p ? productName(p, locale) : (labels.noFlooring ?? "-");
  };
  const shown = rooms.filter((r) => !plan.skipped.includes(r.id));
  const failed = status === "unsupported" || status === "lost";

  return (
    <section className={cx("w-full", className)} aria-label={labels.title}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-line bg-surface">
        <div ref={hostRef} className="absolute inset-0" aria-describedby={hintId} />
        {status === "loading" ? (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-[16px] text-ink-muted">
            {labels.loading}
          </p>
        ) : null}
        {failed ? (
          <p role="alert" className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-[16px] text-ink">
            {labels.unsupported}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={labels.title}>
        <button type="button" aria-pressed={mode === "top"} disabled={failed} onClick={() => choose("top")} className={cx(btn, "disabled:opacity-45", mode === "top" ? "border-ink bg-ink text-surface" : "border-border-strong bg-surface-raised text-ink")}>
          {labels.topView}
        </button>
        <button type="button" aria-pressed={mode === "interior"} disabled={failed} onClick={() => choose("interior")} className={cx(btn, "disabled:opacity-45", mode === "interior" ? "border-ink bg-ink text-surface" : "border-border-strong bg-surface-raised text-ink")}>
          {labels.interior}
        </button>
        <button type="button" disabled={failed} onClick={() => engineRef.current?.reset()} className={cx(btn, "border-border-strong bg-surface-raised text-ink disabled:opacity-45")}>
          {labels.reset}
        </button>
      </div>

      <p id={hintId} className="mt-3 text-[14px] leading-5 text-ink-muted">
        {labels.orbitHint}
      </p>
      {labels.legend ? <p className="mt-1 text-[14px] leading-5 text-ink-muted">{labels.legend}</p> : null}

      <ul className="mt-3 grid gap-1 text-[14px] leading-5 text-ink">
        {shown.map((r) => (
          <li key={r.id}>
            <span className="font-semibold">{r.name}</span>
            <span className="text-ink-muted">{" : "}</span>
            <span>{flooringName(r)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default FlooringPreview3D;
