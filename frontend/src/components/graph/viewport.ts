import { useGraph } from '../../store/graph';
import { useUi } from '../../store/ui';
import type { SimNode } from './model';

/**
 * The map runs under the glass panels, so "fit the map" means fit it into the clear area between them.
 * These are the pixels each panel covers, including the 12px page padding and gap (see App.tsx).
 */
export interface Insets {
  left: number;
  right: number;
  top: number;
}

const TOP_BAR = 80; // 12 padding + 56 bar + 12 gap
const RAIL_NAV = 80; // 12 + 56 icon column + 12
const RAIL_OPEN = 382; // 12 + 56 + 300 panel + 2 borders + 12
const SIDE_PANEL = 404; // 12 + 380 + 12

export function useMapInsets(): Insets {
  const railOpen = useUi(s => s.railOpen);
  const askOpen = useUi(s => s.askOpen);
  const selecting = useGraph(s => s.selectedId !== null);
  return { left: railOpen ? RAIL_OPEN : RAIL_NAV, right: askOpen || selecting ? SIDE_PANEL : 0, top: TOP_BAR };
}

interface Box {
  cx: number;
  cy: number;
  cz: number;
  halfX: number;
  halfY: number;
  halfZ: number;
}

function bounds(nodes: SimNode[]): Box | null {
  const placed = nodes.filter(n => n.x !== undefined && n.y !== undefined);
  if (!placed.length) return null;
  const xs = placed.map(n => n.x!);
  const ys = placed.map(n => n.y!);
  const zs = placed.map(n => n.z ?? 0);
  const [minX, maxX, minY, maxY, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), Math.min(...zs), Math.max(...zs)];
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    cz: (minZ + maxZ) / 2,
    halfX: Math.max((maxX - minX) / 2, 10),
    halfY: Math.max((maxY - minY) / 2, 10),
    halfZ: (maxZ - minZ) / 2,
  };
}

/** Clear area in pixels, with a margin so labels at the edge stay readable. */
function clearArea(width: number, height: number, insets: Insets) {
  const margin = 12;
  return {
    w: Math.max(160, width - insets.left - insets.right - margin * 2),
    h: Math.max(160, height - insets.top - margin * 3),
    // Offset of the clear area's centre from the canvas centre, in pixels (x right, y down).
    dx: (insets.left - insets.right) / 2,
    dy: insets.top / 2,
  };
}

interface Camera3D {
  cameraPosition: (pos: { x: number; y: number; z: number }, lookAt: { x: number; y: number; z: number }, ms: number) => unknown;
  camera: () => unknown;
}

/** 3D: a camera looking down the z axis that frames every node inside the clear area. */
export function fit3D(api: Camera3D, nodes: SimNode[], width: number, height: number, insets: Insets, ms: number) {
  const box = bounds(nodes);
  if (!box) return;
  const fov = ((api.camera() as { fov?: number }).fov ?? 40) * (Math.PI / 180);
  const tan = Math.tan(fov / 2);
  const area = clearArea(width, height, insets);
  // Distance at which half the box spans half the clear area, horizontally and vertically.
  const distance = Math.max(box.halfX / (tan * (area.w / height)), box.halfY / (tan * (area.h / height))) + box.halfZ;
  const worldPerPx = (2 * distance * tan) / height;
  const target = { x: box.cx - area.dx * worldPerPx, y: box.cy + area.dy * worldPerPx, z: box.cz };
  api.cameraPosition({ x: target.x, y: target.y, z: target.z + distance }, target, ms);
}

interface Camera2D {
  zoom: (k: number, ms?: number) => unknown;
  centerAt: (x?: number, y?: number, ms?: number) => unknown;
}

/** 2D: the zoom and centre that frame every node inside the clear area. */
export function fit2D(api: Camera2D, nodes: SimNode[], width: number, height: number, insets: Insets, ms: number) {
  const box = bounds(nodes);
  if (!box) return;
  const area = clearArea(width, height, insets);
  const k = Math.min(area.w / (box.halfX * 2), area.h / (box.halfY * 2), 8);
  api.centerAt(box.cx - area.dx / k, box.cy - area.dy / k, ms);
  api.zoom(k, ms);
}
