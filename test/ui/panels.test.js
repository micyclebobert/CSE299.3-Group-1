import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual, throws } from 'assert';
import {
  PANEL_LEFT,
  PANEL_MAIN,
  PANEL_RIGHT,
  PANEL_BOTTOM,
  PanelRegion,
  PanelModel,
} from '../../src/ui/panels.js';

test('PANEL_* constants are the expected strings', () => {
  strictEqual(PANEL_LEFT, 'left');
  strictEqual(PANEL_MAIN, 'main');
  strictEqual(PANEL_RIGHT, 'right');
  strictEqual(PANEL_BOTTOM, 'bottom');
});

test('PanelRegion show/hide/toggle flips visible', () => {
  const region = new PanelRegion({
    id: PANEL_LEFT,
    rect: { x: 0, y: 0, w: 200, h: 600 },
    visible: true,
    zIndex: 0,
  });
  ok(region.visible);
  region.hide();
  ok(!region.visible);
  region.show();
  ok(region.visible);
  region.toggle();
  ok(!region.visible);

  const hidden = new PanelRegion({
    id: PANEL_BOTTOM,
    rect: { x: 0, y: 0, w: 600, h: 150 },
    visible: false,
  });
  ok(!hidden.visible);
  hidden.toggle();
  ok(hidden.visible);
});

test('PanelRegion getters return constructor input', () => {
  const rect = { x: 5, y: 6, w: 70, h: 80 };
  const region = new PanelRegion({ id: PANEL_RIGHT, rect, visible: true, zIndex: 3 });
  strictEqual(region.id, PANEL_RIGHT);
  deepStrictEqual(region.rect, rect);
  strictEqual(region.zIndex, 3);
});

test('PanelRegion rect getter returns a copy, not the live object', () => {
  const region = new PanelRegion({ id: PANEL_LEFT, rect: { x: 0, y: 0, w: 10, h: 10 } });
  const out = region.rect;
  out.w = 999;
  strictEqual(region.rect.w, 10);
});

test('PanelRegion isEqualTo compares id, rect, visible, zIndex', () => {
  const a = new PanelRegion({
    id: PANEL_MAIN,
    rect: { x: 0, y: 0, w: 100, h: 100 },
    visible: true,
    zIndex: 1,
  });
  const b = new PanelRegion({
    id: PANEL_MAIN,
    rect: { x: 0, y: 0, w: 100, h: 100 },
    visible: true,
    zIndex: 1,
  });
  ok(a.isEqualTo(b));
  const c = new PanelRegion({
    id: PANEL_MAIN,
    rect: { x: 0, y: 0, w: 100, h: 100 },
    visible: false,
    zIndex: 1,
  });
  ok(!a.isEqualTo(c));
  ok(!a.isEqualTo(null));
});

test('PanelModel addRegion/getRegion/removeRegion works', () => {
  const model = new PanelModel({ viewport: { x: 0, y: 0, w: 1000, h: 700 } });
  const region = new PanelRegion({ id: PANEL_LEFT, rect: { x: 0, y: 0, w: 250, h: 700 } });
  model.addRegion(region);
  strictEqual(model.getRegion(PANEL_LEFT), region);
  strictEqual(model.getRegion('nope'), undefined);
  ok(model.regions.has(PANEL_LEFT));
  strictEqual(model.regions.size, 1);
  throws(() => model.addRegion(new PanelRegion({ id: PANEL_LEFT, rect: { x: 0, y: 0, w: 1, h: 1 } })));
  strictEqual(model.removeRegion(PANEL_LEFT), true);
  strictEqual(model.getRegion(PANEL_LEFT), undefined);
  strictEqual(model.removeRegion(PANEL_LEFT), false);
});

test('setVisible toggles; getVisibleRegions returns only visible', () => {
  const model = new PanelModel({ viewport: { x: 0, y: 0, w: 1000, h: 700 } });
  model.addRegion(new PanelRegion({ id: PANEL_LEFT, rect: { x: 0, y: 0, w: 250, h: 700 } }));
  model.addRegion(new PanelRegion({ id: PANEL_MAIN, rect: { x: 250, y: 0, w: 500, h: 700 } }));
  model.addRegion(new PanelRegion({ id: PANEL_RIGHT, rect: { x: 750, y: 0, w: 250, h: 700 } }));
  model.addRegion(new PanelRegion({ id: PANEL_BOTTOM, rect: { x: 0, y: 550, w: 1000, h: 150 } }));

  strictEqual(model.getVisibleRegions().length, 4);

  model.setVisible(PANEL_LEFT, false);
  strictEqual(model.getVisibleRegions().length, 3);
  ok(model.getVisibleRegions().every((region) => region.id !== PANEL_LEFT));

  model.setVisible(PANEL_LEFT, true);
  strictEqual(model.getVisibleRegions().length, 4);

  model.toggle(PANEL_BOTTOM);
  strictEqual(model.getVisibleRegions().length, 3);
  ok(!model.getVisibleRegions().some((region) => region.id === PANEL_BOTTOM));

  throws(() => model.setVisible('nope', true));
  throws(() => model.toggle('nope'));
});

test('setZOrder orders visible regions by zIndex ascending', () => {
  const model = new PanelModel({ viewport: { x: 0, y: 0, w: 1000, h: 700 } });
  for (const id of [PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM]) {
    model.addRegion(new PanelRegion({ id, rect: { x: 0, y: 0, w: 10, h: 10 } }));
  }
  model.setZOrder(PANEL_LEFT, 3);
  model.setZOrder(PANEL_MAIN, 0);
  model.setZOrder(PANEL_RIGHT, 2);
  model.setZOrder(PANEL_BOTTOM, 1);
  const ids = model.getVisibleRegions().map((region) => region.id);
  deepStrictEqual(ids, [PANEL_MAIN, PANEL_BOTTOM, PANEL_RIGHT, PANEL_LEFT]);
  throws(() => model.setZOrder('nope', 0));
});

test('getLayoutRects returns four rects; main excludes docked side/bottom space', () => {
  const viewport = { x: 10, y: 20, w: 1000, h: 700 };
  const model = new PanelModel({ viewport });
  model.addRegion(new PanelRegion({ id: PANEL_LEFT, rect: { x: 0, y: 0, w: 250, h: 700 } }));
  model.addRegion(new PanelRegion({ id: PANEL_MAIN, rect: { x: 250, y: 0, w: 500, h: 700 } }));
  model.addRegion(new PanelRegion({ id: PANEL_RIGHT, rect: { x: 750, y: 0, w: 250, h: 700 } }));
  model.addRegion(new PanelRegion({ id: PANEL_BOTTOM, rect: { x: 0, y: 550, w: 1000, h: 150 } }));

  const rects = model.getLayoutRects();
  strictEqual(Object.keys(rects).length, 4);
  deepStrictEqual(rects.left, { x: 10, y: 20, w: 250, h: 700 });
  deepStrictEqual(rects.right, { x: 760, y: 20, w: 250, h: 700 });
  deepStrictEqual(rects.bottom, { x: 10, y: 570, w: 1000, h: 150 });
  deepStrictEqual(rects.main, { x: 260, y: 20, w: 500, h: 550 });

  model.setVisible(PANEL_RIGHT, false);
  const collapsed = model.getLayoutRects();
  strictEqual(collapsed.right, null);
  deepStrictEqual(collapsed.main, { x: 260, y: 20, w: 750, h: 550 });
  model.setVisible(PANEL_RIGHT, true);
  deepStrictEqual(model.getLayoutRects().main, rects.main);
});

test('getLayoutRects handles missing regions gracefully', () => {
  const model = new PanelModel({ viewport: { x: 3, y: 4, w: 100, h: 200 } });
  const rects = model.getLayoutRects();
  strictEqual(rects.left, null);
  strictEqual(rects.right, null);
  strictEqual(rects.bottom, null);
  deepStrictEqual(rects.main, { x: 3, y: 4, w: 100, h: 200 });
});
