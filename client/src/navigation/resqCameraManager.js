// Driving camera perspective manager with speed-adaptive zoom, pitch, and follow mode

export class ResqCameraManager {
  constructor(map, onUserInteracted) {
    this.map = map;
    this.onUserInteracted = onUserInteracted;
    this.isListening = false;
    this.lastBearing = 0;

    this.handleInteraction = this.handleInteraction.bind(this);
  }

  // Attaches interaction listeners to detect user manual map panning
  attachListeners() {
    if (!this.map || this.isListening) return;

    this.map.on("dragstart", this.handleInteraction);
    this.map.on("rotatestart", this.handleInteraction);
    this.map.on("pitchstart", this.handleInteraction);
    this.map.on("wheel", this.handleInteraction);
    this.map.on("touchstart", this.handleInteraction);

    this.isListening = true;
  }

  // Detaches user interaction listeners
  detachListeners() {
    if (!this.map || !this.isListening) return;

    this.map.off("dragstart", this.handleInteraction);
    this.map.off("rotatestart", this.handleInteraction);
    this.map.off("pitchstart", this.handleInteraction);
    this.map.off("wheel", this.handleInteraction);
    this.map.off("touchstart", this.handleInteraction);

    this.isListening = false;
  }

  // Dispatches callback when user manually touches or pans the map
  handleInteraction() {
    if (this.onUserInteracted) {
      this.onUserInteracted();
    }
  }

  // Calculates speed-adaptive zoom level
  getZoomForSpeed(speedKmh = 0) {
    if (speedKmh > 75) return 15.2;
    if (speedKmh > 45) return 16.2;
    if (speedKmh > 20) return 17.0;
    return 17.6;
  }

  // Updates camera perspective following the vehicle
  followVehicle([lon, lat], heading = 0, speedKmh = 0, isImmediate = false) {
    if (!this.map || isNaN(lat) || isNaN(lon)) return;

    const targetZoom = this.getZoomForSpeed(speedKmh);
    const targetPitch = 55;
    const targetBearing = typeof heading === "number" && !isNaN(heading) ? heading : this.lastBearing;
    this.lastBearing = targetBearing;

    // Offset camera center slightly ahead of vehicle (places vehicle in lower third)
    const isMobile = window.innerWidth <= 768;
    const verticalPadding = isMobile
      ? { top: 120, bottom: 220, left: 20, right: 20 }
      : { top: 140, bottom: 180, left: 40, right: 40 };

    if (isImmediate) {
      this.map.jumpTo({
        center: [lon, lat],
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        padding: verticalPadding,
      });
    } else {
      this.map.easeTo({
        center: [lon, lat],
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        padding: verticalPadding,
        duration: 900,
        essential: true,
      });
    }
  }

  // Restores standard overhead 2D overview camera when exiting navigation
  resetCamera(center, zoom = 12) {
    if (!this.map) return;

    this.map.easeTo({
      center: center || this.map.getCenter(),
      zoom: zoom || 12,
      pitch: 0,
      bearing: 0,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 1000,
      essential: true,
    });
  }

  // Cleans up all listeners
  destroy() {
    this.detachListeners();
    this.map = null;
    this.onUserInteracted = null;
  }
}

export default ResqCameraManager;
