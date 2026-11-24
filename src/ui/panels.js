export const PANEL_LEFT = 'left';
export const PANEL_MAIN = 'main';
export const PANEL_RIGHT = 'right';
export const PANEL_BOTTOM = 'bottom';

const copyRect = (rect) => ({
  x: rect.x,
  y: rect.y,
  w: rect.w,
  h: rect.h,
});

export class PanelRegion {
  #id;
  #rect;
  #visible;
  #zIndex;

  constructor({ id, rect, visible = true, zIndex = 0 }) {
    this.#id = id;
    this.#rect = copyRect(rect);
    this.#visible = Boolean(visible);
    this.#zIndex = Number(zIndex);
  }

  get id() {
    return this.#id;
  }

  get rect() {
    return copyRect(this.#rect);
  }

  get visible() {
    return this.#visible;
  }

  get zIndex() {
    return this.#zIndex;
  }

  show() {
    this.#visible = true;
  }

  hide() {
    this.#visible = false;
  }

  toggle() {
    this.#visible = !this.#visible;
  }

  setRect(rect) {
    this.#rect = copyRect(rect);
  }

  setZIndex(zIndex) {
    this.#zIndex = Number(zIndex);
  }

  isEqualTo(other) {
    if (!(other instanceof PanelRegion)) {
      return false;
    }
    return (
      other.id === this.#id
      && other.visible === this.#visible
      && other.zIndex === this.#zIndex
      && other.rect.x === this.#rect.x
      && other.rect.y === this.#rect.y
      && other.rect.w === this.#rect.w
      && other.rect.h === this.#rect.h
    );
  }
}

export class PanelModel {
  #viewport;
  #regions;
  #docks;

  constructor({ viewport } = {}) {
    this.#viewport = viewport ? { ...viewport } : { x: 0, y: 0, w: 0, h: 0 };
    this.#regions = new Map();
    this.#docks = new Map();
  }

  get viewport() {
    return { ...this.#viewport };
  }

  get regions() {
    return this.#regions;
  }

  addRegion(region) {
    if (!(region instanceof PanelRegion)) {
      throw new Error('PanelModel.addRegion: expected a PanelRegion');
    }
    if (this.#regions.has(region.id)) {
      throw new Error(`PanelModel.addRegion: duplicate region id: ${region.id}`);
    }
    this.#regions.set(region.id, region);
  }

  removeRegion(id) {
    return this.#regions.delete(id);
  }

  getRegion(id) {
    return this.#regions.get(id);
  }

  setVisible(id, visible) {
    const region = this.#regions.get(id);
    if (!region) {
      throw new Error(`PanelModel.setVisible: unknown region id: ${id}`);
    }
    if (Boolean(visible)) {
      region.show();
    } else {
      region.hide();
    }
  }

  toggle(id) {
    const region = this.#regions.get(id);
    if (!region) {
      throw new Error(`PanelModel.toggle: unknown region id: ${id}`);
    }
    region.toggle();
  }

  setZOrder(id, zIndex) {
    const region = this.#regions.get(id);
    if (!region) {
      throw new Error(`PanelModel.setZOrder: unknown region id: ${id}`);
    }
    region.setZIndex(zIndex);
  }

  getVisibleRegions() {
    return [...this.#regions.values()]
      .filter((region) => region.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getLayoutRects() {
    const v = this.#viewport;
    const leftRegion = this.#regions.get(PANEL_LEFT);
    const rightRegion = this.#regions.get(PANEL_RIGHT);
    const bottomRegion = this.#regions.get(PANEL_BOTTOM);

    const leftW = (leftRegion && leftRegion.visible) ? leftRegion.rect.w : 0;
    const rightW = (rightRegion && rightRegion.visible) ? rightRegion.rect.w : 0;
    const bottomH = (bottomRegion && bottomRegion.visible) ? bottomRegion.rect.h : 0;

    const left = (leftRegion && leftRegion.visible)
      ? { x: v.x, y: v.y, w: leftW, h: v.h }
      : null;
    const right = (rightRegion && rightRegion.visible)
      ? { x: v.x + v.w - rightW, y: v.y, w: rightW, h: v.h }
      : null;
    const bottom = (bottomRegion && bottomRegion.visible)
      ? { x: v.x, y: v.y + v.h - bottomH, w: v.w, h: bottomH }
      : null;
    const main = {
      x: v.x + leftW,
      y: v.y,
      w: Math.max(0, v.w - leftW - rightW),
      h: Math.max(0, v.h - bottomH),
    };

    return { left, main, right, bottom };
  }

  applyLayoutRects(viewport) {
    const v = viewport ? { ...viewport } : { ...this.#viewport };
    const leftRegion = this.#regions.get(PANEL_LEFT);
    const rightRegion = this.#regions.get(PANEL_RIGHT);
    const bottomRegion = this.#regions.get(PANEL_BOTTOM);

    const leftW = (leftRegion && leftRegion.visible) ? Math.max(0, leftRegion.rect.w) : 0;
    const rightW = (rightRegion && rightRegion.visible) ? Math.max(0, rightRegion.rect.w) : 0;
    const bottomH = (bottomRegion && bottomRegion.visible) ? Math.max(0, bottomRegion.rect.h) : 0;

    const mainW = Math.max(0, v.w - leftW - rightW);
    const mainH = Math.max(0, v.h - bottomH);

    return {
      leftW,
      rightW,
      bottomH,
      mainW,
      mainH,
      gridTemplateColumns: `${leftW}px ${mainW > 0 ? '1fr' : '0px'} ${rightW}px`,
      gridTemplateRows: `${mainH > 0 ? '1fr' : '0px'} ${bottomH}px`,
      rects: this.getLayoutRects(),
    };
  }

  resizeRegion(id, { width, height } = {}) {
    const region = this.#regions.get(id);
    if (!region) {
      throw new Error(`PanelModel.resizeRegion: unknown region id: ${id}`);
    }
    const rect = { ...region.rect };
    if (Number.isFinite(width)) {
      rect.w = Math.max(0, width);
    }
    if (Number.isFinite(height)) {
      rect.h = Math.max(0, height);
    }
    region.setRect(rect);
    return { ...rect };
  }

  dockRegion(id, position) {
    const region = this.#regions.get(id);
    if (!region) {
      throw new Error(`PanelModel.dockRegion: unknown region id: ${id}`);
    }
    this.#docks.set(id, position);
    const dockCount = [...this.#docks.values()].length;
    region.setZIndex(dockCount);
    return { id, position, zIndex: region.zIndex };
  }

  getDock(id) {
    return this.#docks.get(id);
  }

  saveLayout() {
    return {
      viewport: { ...this.#viewport },
      regions: [...this.#regions.entries()].map(([id, region]) => ({
        id,
        rect: region.rect,
        visible: region.visible,
        zIndex: region.zIndex,
      })),
      docks: [...this.#docks.entries()],
    };
  }

  loadLayout(state) {
    if (!state || typeof state !== 'object') {
      throw new Error('PanelModel.loadLayout: expected a layout state object');
    }
    if (state.viewport) {
      this.#viewport = { ...state.viewport };
    }
    for (const entry of state.regions ?? []) {
      const region = this.#regions.get(entry.id);
      if (region) {
        if (entry.rect) {
          region.setRect({ ...entry.rect });
        }
        if (entry.visible !== undefined) {
          if (Boolean(entry.visible)) {
            region.show();
          } else {
            region.hide();
          }
        }
        if (Number.isFinite(entry.zIndex)) {
          region.setZIndex(entry.zIndex);
        }
      }
    }
    if (state.docks) {
      for (const [id, position] of state.docks) {
        this.#docks.set(id, position);
      }
    }
    return this.saveLayout();
  }
}
