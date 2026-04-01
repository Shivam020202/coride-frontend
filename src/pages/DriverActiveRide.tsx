import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  useIonToast,
} from "@ionic/react";
import {
  personCircleOutline,
  callOutline,
  chatbubbleOutline,
  navigateCircleOutline,
  locationOutline,
  carSport,
} from "ionicons/icons";
import {
  GoogleMap,
  useJsApiLoader,
  DirectionsRenderer,
  Marker,
} from "@react-google-maps/api";
import { useHistory, useLocation } from "react-router-dom";
import socket from "../socket";
import "./DriverActiveRide.css";
import "./ActiveRide.css";

const libraries: "places"[] = ["places"];

const DriverActiveRide: React.FC = () => {
  const [status, setStatus] = useState<
    "picking_up" | "arrived" | "in_transit" | "completed"
  >("picking_up");
  const [presentToast] = useIonToast();
  const history = useHistory();
  const location = useLocation<any>();
  const [rideDetails, setRideDetails] = useState<any>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] =
    useState<google.maps.DirectionsResult | null>(null);

  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);

  const customCarIcon = {
    url: "https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_637/v1555367310/assets/30/51e602-10bb-4e65-b122-e394d80a1c97/original/UberX_Transparent.png",
    scaledSize: window.google?.maps?.Size
      ? new window.google.maps.Size(70, 45)
      : null,
  };

  useEffect(() => {
    console.log("[DriverActiveRide] location.state:", location.state);
    if (location.state?.activeRide) {
      console.log("[DriverActiveRide] Setting rideDetails from activeRide:", location.state.activeRide);
      setRideDetails(location.state.activeRide);
    } else if (location.state?.requestId) {
      setRideDetails({
        id: location.state.requestId,
        user: location.state.user || "Passenger",
        destination: location.state.destination || "Destination",
        pickup: location.state.pickup || "Pickup location",
      });
    }
  }, [location.state]);

  // Track which route segment we last fetched so we only re-fetch when it changes
  const [lastRouteKey, setLastRouteKey] = useState("");

  useEffect(() => {
    if (!isLoaded || !map || !rideDetails) return;

    // Determine origin and destination based on current status
    let reqOrigin: string | google.maps.LatLngLiteral;
    let reqDest: string;

    if (status === "picking_up" || status === "arrived") {
      // Driver heading to pickup (or already there) — show route from driver to pickup
      if (driverLoc) {
        reqOrigin = driverLoc;
      } else {
        // No GPS yet — use pickup as both so map at least centers on ride area
        reqOrigin = rideDetails.pickup;
      }
      reqDest = rideDetails.pickup;
    } else {
      // in_transit — show pickup to destination route
      reqOrigin = rideDetails.pickup;
      reqDest = rideDetails.destination;
    }

    // Build a key so we only re-fetch when the segment actually changes
    const originKey = typeof reqOrigin === "string"
      ? reqOrigin
      : `${reqOrigin.lat.toFixed(3)},${reqOrigin.lng.toFixed(3)}`;
    const routeKey = `${status}|${originKey}|${reqDest}`;
    if (routeKey === lastRouteKey) return;

    const fetchDirections = async () => {
      const directionsService = new window.google.maps.DirectionsService();
      try {
        const results = await directionsService.route({
          origin: reqOrigin,
          destination: reqDest,
          travelMode: window.google.maps.TravelMode.DRIVING,
        });
        setDirectionsResponse(results);
        setLastRouteKey(routeKey);
        if (results.routes[0]?.bounds) {
          map.fitBounds(results.routes[0].bounds);
        }
      } catch (err) {
        console.warn("Directions failed", err);
        // If we have driver GPS, center there; otherwise center on a neutral spot
        if (driverLoc) {
          map.setCenter(driverLoc);
          map.setZoom(14);
        }
      }
    };

    fetchDirections();
  }, [isLoaded, map, rideDetails, status, driverLoc]);

  // Request live driver location
  useEffect(() => {
    if (!rideDetails?.id || status === "completed") return;

    let watchId: number | null = null;
    let isSubscribed = true;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!isSubscribed) return;
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverLoc(newLoc);
          socket.emit("updateLocation", {
            rideId: rideDetails.id,
            location: newLoc,
          });
        },
        (err) => console.warn("Driver location error:", err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    return () => {
      isSubscribed = false;
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [status, rideDetails]);

  const handleAction = () => {
    let nextStatus = "";
    if (status === "picking_up") {
      nextStatus = "arrived";
      setStatus("arrived");
      presentToast({
        message: "Notified rider you have arrived.",
        duration: 2000,
        color: "success",
      });
    } else if (status === "arrived") {
      nextStatus = "in_transit";
      setStatus("in_transit");
      presentToast({
        message: "Ride started. Navigating to destination.",
        duration: 2000,
        color: "primary",
      });
    } else if (status === "in_transit") {
      nextStatus = "completed";
      setStatus("completed");
      setShowRatingModal(true);
    }

    if (nextStatus) {
      socket.emit("updateRideStatus", {
        rideId: rideDetails.id,
        status: nextStatus,
      });
    }
  };

  const getActionText = () => {
    switch (status) {
      case "picking_up":
        return "ARRIVED AT PICKUP";
      case "arrived":
        return "START RIDE";
      case "in_transit":
        return "COMPLETE RIDE";
      default:
        return "COMPLETING...";
    }
  };

  if (!rideDetails) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Loading Ride...</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-text-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ paddingTop: '40vh', textAlign: 'center' }}>
            <IonIcon icon={carSport} style={{ fontSize: '54px', color: '#2563eb', marginBottom: '16px' }} />
            <p style={{ fontSize: '18px', fontWeight: 600 }}>Starting Navigation...</p>
            <p style={{ color: '#666', marginTop: '8px' }}>Preparing your ride details</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/driver/home" />
          </IonButtons>
          <IonTitle>
            {status === "in_transit" ? "Drop off" : "Pick up"}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="driver-active-content">
        <div className="map-container driver-map" style={{ height: "55vh" }}>
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={driverLoc || undefined}
              zoom={14}
              options={{
                zoomControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
              onLoad={(map) => setMap(map)}
            >
              {directionsResponse && (
                <DirectionsRenderer directions={directionsResponse} />
              )}
              {driverLoc && customCarIcon.scaledSize && (
                <Marker position={driverLoc} icon={customCarIcon as google.maps.Icon} />
              )}
            </GoogleMap>
          )}
        </div>

        <div className="ride-panel">
          <div className="panel-handle"></div>

          <div className="rider-info">
            <IonIcon icon={personCircleOutline} className="rider-avatar" />
            <div className="rider-details">
              <h2>{rideDetails.user}</h2>
              <p>⭐️ 4.9</p>
            </div>
            <div className="action-buttons">
              <IonButton
                color="medium"
                fill="solid"
                onClick={() => presentToast("Calling rider...", 1500)}
              >
                <IonIcon icon={callOutline} />
              </IonButton>
              <IonButton
                color="medium"
                fill="solid"
                onClick={() => presentToast("Opening chat...", 1500)}
              >
                <IonIcon icon={chatbubbleOutline} />
              </IonButton>
            </div>
          </div>

          <div className="ride-status-info">
            <div className="eta">
              <h3>{status === "in_transit" ? (rideDetails.time || "15 Min") : (rideDetails.time || "5 Min")}</h3>
              <p>{status === "in_transit" ? "to destination" : "to pickup"}</p>
            </div>
            <div className="destination">
              <IonIcon icon={navigateCircleOutline} />
              <span>
                {status === "in_transit"
                  ? rideDetails.destination
                  : rideDetails.pickup}
              </span>
            </div>
          </div>

          <IonButton
            expand="block"
            className="swipe-btn"
            color={status === "in_transit" ? "danger" : "dark"}
            onClick={handleAction}
          >
            {getActionText()}
          </IonButton>
        </div>

        {/* Rating modal overlay */}
        {showRatingModal && (
          <div className="rating-overlay">
            <div className="rating-panel">
              <div className="rating-checkmark">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#18181b" />
                  <path d="M15 24.5L21 30.5L33 18.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="rating-title">Ride Complete!</h2>
              <p className="rating-fare">${rideDetails?.price || "25.00"}</p>
              <p className="rating-subtitle">How was your rider, {rideDetails?.user || "Rider"}?</p>

              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`rating-star ${star <= (hoverRating || rating) ? "active" : ""}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill={star <= (hoverRating || rating) ? "#18181b" : "none"} stroke="#18181b" strokeWidth="1.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
              <p className="rating-label">
                {rating === 0 ? "Tap to rate" : rating <= 2 ? "We're sorry to hear that" : rating <= 3 ? "Thanks for the ride" : rating === 4 ? "Great rider!" : "Excellent!"}
              </p>

              <button
                className="rating-submit-btn"
                disabled={rating === 0}
                onClick={() => {
                  presentToast({
                    message: `You rated ${rideDetails?.user || "Rider"} ${rating} star${rating > 1 ? "s" : ""}. Thanks!`,
                    duration: 2500,
                    color: "success",
                  });
                  setShowRatingModal(false);
                  history.push("/driver/home");
                }}
              >
                Submit Rating
              </button>

              <button
                className="rating-skip-btn"
                onClick={() => {
                  setShowRatingModal(false);
                  history.push("/driver/home");
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default DriverActiveRide;
