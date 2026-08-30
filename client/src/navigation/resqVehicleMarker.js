// Vehicle navigation marker management for RESQ MapLibre vector canvas

import maplibreModule from "maplibre-gl";

const MarkerClass = maplibreModule.Marker || (maplibreModule.default && maplibreModule.default.Marker);

// Creates vehicle marker DOM element with directional chevron and subtle pulse glow
function createMarkerElement() {
  const container = document.createElement("div");
  container.className = "resq-vehicle-nav-marker";
  container.style.width = "48px";
  container.style.height = "48px";
  container.style.position = "relative";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.pointerEvents = "none";
  container.style.transformOrigin = "center center";

  // Pulse halo ring
  const pulseRing = document.createElement("div");
  pulseRing.style.position = "absolute";
  pulseRing.style.inset = "4px";
  pulseRing.style.borderRadius = "50%";
  pulseRing.style.background = "rgba(37, 99, 235, 0.22)";
  pulseRing.style.border = "1.5px solid rgba(37, 99, 235, 0.4)";
  pulseRing.style.animation = "pulseRing 2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite";
  container.appendChild(pulseRing);

  // Directional puck body
  const puck = document.createElement("div");
  puck.className = "resq-vehicle-puck";
  puck.style.width = "32px";
  puck.style.height = "32px";
  puck.style.borderRadius = "50%";
  puck.style.background = "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)";
  puck.style.border = "3px solid #ffffff";
  puck.style.boxShadow = "0 4px 14px rgba(15, 23, 42, 0.35), 0 0 10px rgba(37, 99, 235, 0.4)";
  puck.style.display = "flex";
  puck.style.alignItems = "center";
  puck.style.justifyContent = "center";
  puck.style.position = "relative";
  puck.style.zIndex = "2";
  puck.style.transition = "transform 0.18s ease-out";

  // Directional arrow icon
  const arrow = document.createElement("div");
  arrow.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L19 20L12 16.5L5 20L12 3Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  `;
  arrow.style.display = "flex";
  arrow.style.alignItems = "center";
  arrow.style.justifyContent = "center";

  puck.appendChild(arrow);
  container.appendChild(puck);

  return { container, puck };
}

export class ResqVehicleMarker {
  constructor() {
    this.marker = null;
    this.elementRefs = null;
    this.currentHeading = 0;
  }

  // Updates or creates the vehicle marker on the map with smooth heading rotation
  update(map, [lon, lat], heading = 0) {
    if (!map || isNaN(lat) || isNaN(lon)) return;

    if (!this.marker) {
      this.elementRefs = createMarkerElement();
      this.marker = new MarkerClass({
        element: this.elementRefs.container,
        anchor: "center",
        rotationAlignment: "map",
        pitchAlignment: "map",
      })
        .setLngLat([lon, lat])
        .addTo(map);
    } else {
      this.marker.setLngLat([lon, lat]);
    }

    if (typeof heading === "number" && !isNaN(heading)) {
      this.currentHeading = heading;
      if (this.elementRefs && this.elementRefs.puck) {
        this.elementRefs.puck.style.transform = `rotate(${heading}deg)`;
      }
    }
  }

  // Removes marker and cleans up DOM elements
  remove() {
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
      this.elementRefs = null;
    }
  }
}

export default ResqVehicleMarker;
