const assert = require('node:assert/strict');
const {
  fitCameraToBounds,
  worldToScreen,
  screenToWorld,
  panCameraByScreenDelta,
  zoomAtScreenPoint,
  getMinimapViewportRect
} = require('./invest-canvas-camera.js');

const bounds = { x: 0, y: 0, width: 1000, height: 500 };
const viewport = { width: 500, height: 250 };
const limits = { minZoom: 0.05, maxZoom: 8 };

function testWorldScreenInverse(){
  const camera = fitCameraToBounds(bounds, viewport, limits);
  const world = { x: 320, y: 160 };
  const screen = worldToScreen(world, camera);
  const restored = screenToWorld(screen, camera);
  assert(Math.abs(restored.x - world.x) < 1e-6);
  assert(Math.abs(restored.y - world.y) < 1e-6);
}

function testZoomKeepsCursorWorldPointStable(){
  const camera = fitCameraToBounds(bounds, viewport, limits);
  const screenPoint = { x: 120, y: 80 };
  const before = screenToWorld(screenPoint, camera);
  const next = zoomAtScreenPoint(camera, screenPoint, 1.4, bounds, viewport, limits);
  const after = screenToWorld(screenPoint, next);
  assert(Math.abs(after.x - before.x) < 1e-6);
  assert(Math.abs(after.y - before.y) < 1e-6);
}

function testMinimapViewportRectHasPositiveArea(){
  const camera = fitCameraToBounds(bounds, viewport, limits);
  const rect = getMinimapViewportRect(camera, bounds, viewport, { width: 200, height: 100 });
  assert(rect.width > 0);
  assert(rect.height > 0);
}

function testVerticalPanRemainsAvailableWhenViewportIsTallerThanBounds(){
  const tallViewport = { width: 500, height: 1200 };
  const camera = fitCameraToBounds(bounds, tallViewport, limits);
  const panned = panCameraByScreenDelta(camera, { x: 0, y: 120 }, bounds, tallViewport);
  assert.notEqual(panned.y, camera.y);
}

testWorldScreenInverse();
testZoomKeepsCursorWorldPointStable();
testMinimapViewportRectHasPositiveArea();
testVerticalPanRemainsAvailableWhenViewportIsTallerThanBounds();

console.log('invest-canvas-camera.test.cjs passed');
