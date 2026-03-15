import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonSpinner } from "@ionic/react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { io } from "socket.io-client";
import "./TrackRide.css";

const libraries: "places"[] = ["places"];

const TrackRide: React.FC = () => {
  // Parse token from URL query string
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  useEffect(() => {
    if (!token) return;

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    // Socket URL = base without /api
    const socketUrl = apiUrl.replace("/api", "");

    const trackSocket = io(socketUrl, { transports: ["websocket", "polling"] });

    trackSocket.on("connect", () => {
      setConnected(true);
      trackSocket.emit("trackRide", { token });
    });

    trackSocket.on("liveLocation", (loc: { lat: number; lng: number }) => {
      setLocation(loc);
      setLastUpdated(new Date());
    });

    trackSocket.on("disconnect", () => setConnected(false));

    return () => {
      trackSocket.disconnect();
    };
  }, [token]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (!token) {
    return (
      <IonPage>
        <IonContent>
          <div className="track-error">
            <span>🔗</span>
            <h2>Invalid tracking link</h2>
            <p>This link is missing a tracking token. Please ask the rider to re-share.</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen className="track-content">
        {/* Header bar */}
        <div className="track-header">
          <div className="track-header-brand">🚗 CoRide</div>
          <div className={`track-status-pill ${connected ? "connected" : "disconnected"}`}>
            <span className="track-dot" />
            {connected ? "Live" : "Connecting…"}
          </div>
        </div>

        {/* Map */}
        <div className="track-map-wrapper">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={location || { lat: 20.5937, lng: 78.9629 }}
              zoom={location ? 16 : 5}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {location && (
                <Marker
                  position={location}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#dc2626",
                    fillOpacity: 1,
                    strokeWeight: 3,
                    strokeColor: "#ffffff",
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="track-map-loading">
              <IonSpinner name="crescent" />
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="track-info-panel">
          {!location ? (
            <div className="track-waiting">
              <IonSpinner name="dots" color="danger" />
              <div>
                <strong>Waiting for location…</strong>
                <p>The rider's location will appear as soon as they start sharing.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="track-coords-row">
                <div className="track-coords-item">
                  <span className="track-coords-label">Latitude</span>
                  <strong>{location.lat.toFixed(6)}</strong>
                </div>
                <div className="track-divider" />
                <div className="track-coords-item">
                  <span className="track-coords-label">Longitude</span>
                  <strong>{location.lng.toFixed(6)}</strong>
                </div>
              </div>

              {lastUpdated && (
                <p className="track-updated">
                  Last updated: {formatTime(lastUpdated)}
                </p>
              )}

              <a
                className="track-maps-btn"
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                📍 Open in Google Maps
              </a>
            </>
          )}

          <p className="track-footer-note">
            This is a live CoRide safety tracking link. Location updates every few seconds.
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TrackRide;
