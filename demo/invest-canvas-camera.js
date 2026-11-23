(function(global){
  var DEFAULT_LIMITS = {
    minZoom: 0.03,
    maxZoom: 6
  };

  function normalizeBounds(bounds){
    return {
      x: Number(bounds.x) || 0,
      y: Number(bounds.y) || 0,
      width: Math.max(1, Number(bounds.width) || 1),
      height: Math.max(1, Number(bounds.height) || 1)
    };
  }

  function clampZoom(zoom, limits){
    var nextLimits = limits || DEFAULT_LIMITS;
    return Math.max(nextLimits.minZoom, Math.min(nextLimits.maxZoom, zoom));
  }

  function clampCamera(camera, bounds, viewport){
    var nextBounds = normalizeBounds(bounds);
    var viewWidth = viewport.width / camera.zoom;
    var viewHeight = viewport.height / camera.zoom;
        var minX = nextBounds.x;
        var minY = nextBounds.y;
        var maxX = nextBounds.x + nextBounds.width - viewWidth;
        var maxY = nextBounds.y + nextBounds.height - viewHeight;

    if(maxX < minX){
          minX = nextBounds.x + nextBounds.width - viewWidth;
          maxX = nextBounds.x;
          camera.x = Math.min(Math.max(camera.x, minX), maxX);
    } else {
      camera.x = Math.min(Math.max(camera.x, minX), maxX);
    }

    if(maxY < minY){
          minY = nextBounds.y + nextBounds.height - viewHeight;
          maxY = nextBounds.y;
          camera.y = Math.min(Math.max(camera.y, minY), maxY);
    } else {
      camera.y = Math.min(Math.max(camera.y, minY), maxY);
    }

    return camera;
  }

  function fitCameraToBounds(bounds, viewport, limits){
    var nextBounds = normalizeBounds(bounds);
    var zoom = clampZoom(Math.min(viewport.width / nextBounds.width, viewport.height / nextBounds.height) * 0.94, limits || DEFAULT_LIMITS);
    var camera = {
      x: nextBounds.x + nextBounds.width / 2 - viewport.width / zoom / 2,
      y: nextBounds.y + nextBounds.height / 2 - viewport.height / zoom / 2,
      zoom: zoom
    };
    return clampCamera(camera, nextBounds, viewport);
  }

  function worldToScreen(point, camera){
    return {
      x: (point.x - camera.x) * camera.zoom,
      y: (point.y - camera.y) * camera.zoom
    };
  }

  function screenToWorld(point, camera){
    return {
      x: camera.x + point.x / camera.zoom,
      y: camera.y + point.y / camera.zoom
    };
  }

  function panCameraByScreenDelta(camera, delta, bounds, viewport){
    var nextCamera = {
      x: camera.x - delta.x / camera.zoom,
      y: camera.y - delta.y / camera.zoom,
      zoom: camera.zoom
    };
    return clampCamera(nextCamera, bounds, viewport);
  }

  function zoomAtScreenPoint(camera, screenPoint, zoomFactor, bounds, viewport, limits){
    var nextZoom = clampZoom(camera.zoom * zoomFactor, limits || DEFAULT_LIMITS);
    var before = screenToWorld(screenPoint, camera);
    var nextCamera = {
      zoom: nextZoom,
      x: before.x - screenPoint.x / nextZoom,
      y: before.y - screenPoint.y / nextZoom
    };
    return clampCamera(nextCamera, bounds, viewport);
  }

  function centerCameraOnWorldPoint(camera, worldPoint, bounds, viewport){
    var nextCamera = {
      x: worldPoint.x - viewport.width / camera.zoom / 2,
      y: worldPoint.y - viewport.height / camera.zoom / 2,
      zoom: camera.zoom
    };
    return clampCamera(nextCamera, bounds, viewport);
  }

  function buildMinimapTransform(bounds, minimapSize){
    var nextBounds = normalizeBounds(bounds);
    var innerWidth = Math.max(1, minimapSize.width - 16);
    var innerHeight = Math.max(1, minimapSize.height - 16);
    var scale = Math.min(innerWidth / nextBounds.width, innerHeight / nextBounds.height);
    var width = nextBounds.width * scale;
    var height = nextBounds.height * scale;

    return {
      scale: scale,
      offsetX: (minimapSize.width - width) / 2,
      offsetY: (minimapSize.height - height) / 2
    };
  }

  function worldToMinimap(point, bounds, minimapSize){
    var nextBounds = normalizeBounds(bounds);
    var transform = buildMinimapTransform(nextBounds, minimapSize);
    return {
      x: transform.offsetX + (point.x - nextBounds.x) * transform.scale,
      y: transform.offsetY + (point.y - nextBounds.y) * transform.scale
    };
  }

  function minimapToWorld(point, bounds, minimapSize){
    var nextBounds = normalizeBounds(bounds);
    var transform = buildMinimapTransform(nextBounds, minimapSize);
    return {
      x: nextBounds.x + (point.x - transform.offsetX) / transform.scale,
      y: nextBounds.y + (point.y - transform.offsetY) / transform.scale
    };
  }

  function getMinimapViewportRect(camera, bounds, viewport, minimapSize){
    var topLeft = worldToMinimap({ x: camera.x, y: camera.y }, bounds, minimapSize);
    var bottomRight = worldToMinimap({
      x: camera.x + viewport.width / camera.zoom,
      y: camera.y + viewport.height / camera.zoom
    }, bounds, minimapSize);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: Math.max(10, bottomRight.x - topLeft.x),
      height: Math.max(10, bottomRight.y - topLeft.y)
    };
  }

  var api = {
    DEFAULT_LIMITS: DEFAULT_LIMITS,
    fitCameraToBounds: fitCameraToBounds,
    clampCamera: clampCamera,
    worldToScreen: worldToScreen,
    screenToWorld: screenToWorld,
    panCameraByScreenDelta: panCameraByScreenDelta,
    zoomAtScreenPoint: zoomAtScreenPoint,
    centerCameraOnWorldPoint: centerCameraOnWorldPoint,
    buildMinimapTransform: buildMinimapTransform,
    worldToMinimap: worldToMinimap,
    minimapToWorld: minimapToWorld,
    getMinimapViewportRect: getMinimapViewportRect
  };

  global.DemoInvestCanvasCamera = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
