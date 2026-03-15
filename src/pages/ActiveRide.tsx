import React, { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonAvatar,
  useIonToast,
  IonSpinner,
} from "@ionic/react";
import {
  close,
  shieldCheckmark,
  shareSocial,
  callOutline,
  chatbubbleOutline,
  warningOutline,
} from "ionicons/icons";
import {
  GoogleMap,
  useJsApiLoader,
  DirectionsRenderer,
  Marker,
} from "@react-google-maps/api";
import socket from "../socket";
import "./ActiveRide.css";

const libraries: "places"[] = ["places"];

const ActiveRide: React.FC = () => {
  const history = useHistory();
  const location = useLocation<{
    origin: string;
    destination: string;
    distance: string;
    duration: string;
    driverName?: string;
    driverCar?: string;
    driverLicense?: string;
    driverRating?: string;
    driverImg?: string;
  }>();
  const state = location.state || {
    rideId: "mock",
    origin: "Times Square, NY",
    destination: "Washington Square Park, NY",
    distance: "2.1 mi",
    duration: "10 min",
    driverName: "John D.",
    driverCar: "White Toyota Prius",
    driverLicense: "ABC 123",
    driverRating: "4.9 ★",
    driverImg:
      "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80",
  };

  const [rideStatus, setRideStatus] = useState("picking_up");
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [present] = useIonToast();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] =
    useState<google.maps.DirectionsResult | null>(null);
  const [carLoc, setCarLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  useEffect(() => {
    const fetchDirections = async () => {
      if (!state.origin || !state.destination) return;
      const directionsService = new window.google.maps.DirectionsService();

      // Fallback handlers if exact coords aren't known or mapping is bad
      let reqOrigin = state.origin;
      if (reqOrigin === "Current Location") {
        reqOrigin = "New York, NY"; // Mock fallback
      }
      let reqDest = state.destination;
      if (reqDest === "Unknown Destination") {
        reqDest = "Central Park, NY"; // Mock fallback
      }

      try {
        const results = await directionsService.route({
          origin: reqOrigin,
          destination: reqDest,
          travelMode: window.google.maps.TravelMode.DRIVING,
        });
        setDirectionsResponse(results);

        if (results.routes[0]?.legs[0]) {
          const start = results.routes[0].legs[0].start_location;
          setCarLoc({
            lat: start.lat() - 0.005,
            lng: start.lng() - 0.005,
          });

          // Force the map to strictly bind to the calculated route
          if (map) {
            map.fitBounds(results.routes[0].bounds);
          }
        }
      } catch (err) {
        console.error("Error calculating directions in ActiveRide", err);
        // Set an arbitrary map center fallback if routing completely fails
        map?.setCenter({ lat: 40.7128, lng: -74.0060 });
        map?.setZoom(12);
      }
    };
    if (isLoaded && map) {
      fetchDirections();
    }
  }, [isLoaded, map, state.origin, state.destination]);

  useEffect(() => {
    socket.on("driverLocationUpdate", (loc: { lat: number; lng: number }) => {
      setDriverLocation(loc);
      if (rideStatus === "picking_up") setCarLoc(loc);
    });

    socket.on("rideStatusUpdate", (status: string) => {
      setRideStatus(status);
      if (status === "arrived") {
        present({
          message: "Driver has arrived!",
          duration: 3000,
          color: "success",
        });
      } else if (status === "in_transit") {
        present({
          message: "Heading to destination!",
          duration: 3000,
          color: "primary",
        });
      } else if (status === "completed") {
        present({
          message: "Ride completed. Thanks for riding!",
          duration: 4000,
          color: "success",
        });
        history.replace("/tabs/home");
      }
    });

    return () => {
      socket.off("driverLocationUpdate");
      socket.off("rideStatusUpdate");
    };
  }, [rideStatus, present, history]);

  const shareLocation = () => {
    present({
      message: "Location shared safely with trusted contacts.",
      duration: 2000,
      position: "bottom",
      icon: shareSocial,
      color: "primary",
    });
  };

  const emergencyCall = () => {
    present({
      message: "Connecting to emergency services...",
      duration: 3000,
      position: "bottom",
      icon: warningOutline,
      color: "danger",
    });
  };

  const customCarIcon = {
    url: "https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_637/v1555367310/assets/30/51e602-10bb-4e65-b122-e394d80a1c97/original/UberX_Transparent.png",
    scaledSize: window.google?.maps
      ? new window.google.maps.Size(70, 45)
      : null,
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <IonSpinner />;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="ride-transparent-toolbar">
          <IonButtons slot="start">
            <IonButton
              className="back-btn-glass"
              onClick={() => history.replace("/tabs/home")}
            >
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ride-content-bg">
        <div
          className="ride-map-fullscreen"
          style={{
            position: "absolute",
            width: "100%",
            height: "55vh",
            top: 0,
            left: 0,
          }}
        >
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={{ lat: 40.7128, lng: -74.006 }}
              zoom={14}
              options={{
                zoomControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
              onLoad={onLoad}
              onUnmount={onUnmount}
            >
              {directionsResponse && (
                <DirectionsRenderer
                  directions={directionsResponse}
                  options={{
                    suppressMarkers: false,
                    polylineOptions: {
                      strokeColor: "#1e3a8a",
                      strokeWeight: 5,
                    },
                  }}
                />
              )}

              {carLoc && customCarIcon.scaledSize && (
                <Marker
                  position={carLoc}
                  icon={customCarIcon as google.maps.Icon}
                />
              )}
            </GoogleMap>
          )}
        </div>

        <div className="ride-bottom-sheet">
          <div className="sheet-pill"></div>

          <div className="ride-sheet-content">
            <div className="ride-header">
              <div>
                <h2 className="ride-status-text">
                  {rideStatus === "arrived"
                    ? "Driver arrived"
                    : rideStatus === "in_transit"
                      ? "Heading to destination"
                      : "Driver is heading to you"}
                </h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "#64748b",
                    fontWeight: 500,
                    fontSize: "0.95rem",
                  }}
                >
                  {rideStatus === "in_transit"
                    ? ""
                    : state.distance || "1.2 mi"}{" "}
                  away
                </p>
              </div>
              <div className="ride-eta-box">
                <span className="ride-time">{state.duration || "4 min"}</span>
              </div>
            </div>

            <div className="driver-card">
              <div className="driver-hero">
                <div className="avatar-wrapper">
                  <IonAvatar className="driver-avatar-real">
                    <img src={state.driverImg} alt="Driver" />
                  </IonAvatar>
                  <div className="rating-pill">{state.driverRating}</div>
                </div>

                <div className="driver-meta">
                  <h3>{state.driverName}</h3>
                  <p>{state.driverCar}</p>
                  <div className="license-badge">{state.driverLicense}</div>
                </div>
              </div>

              <div className="car-image-mock">
                <img
                  src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=400&q=80"
                  alt="car"
                  style={{ borderRadius: "8px", objectFit: "cover" }}
                />
              </div>
            </div>

            <div className="ride-actions">
              <div className="action-circle">
                <IonButton fill="clear" className="circle-btn bg-soft">
                  <IonIcon icon={callOutline} color="dark" />
                </IonButton>
                <span>Call</span>
              </div>
              <div className="action-circle">
                <IonButton fill="clear" className="circle-btn bg-soft">
                  <IonIcon icon={chatbubbleOutline} color="dark" />
                </IonButton>
                <span>Message</span>
              </div>
              <div className="action-circle">
                <IonButton
                  fill="clear"
                  className="circle-btn bg-brand"
                  onClick={shareLocation}
                >
                  <IonIcon icon={shareSocial} color="light" />
                </IonButton>
                <span className="text-brand">Share</span>
              </div>
              <div className="action-circle">
                <IonButton
                  fill="clear"
                  className="circle-btn bg-danger-soft"
                  onClick={emergencyCall}
                >
                  <IonIcon icon={shieldCheckmark} color="danger" />
                </IonButton>
                <span className="text-red">Safety</span>
              </div>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ActiveRide;
