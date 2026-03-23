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
  useIonAlert,
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

const libraries: "places"[] = ["places"];

const DriverActiveRide: React.FC = () => {
  const [status, setStatus] = useState<
    "picking_up" | "arrived" | "in_transit" | "completed"
  >("picking_up");
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const history = useHistory();
  const location = useLocation<any>();
  const [rideDetails, setRideDetails] = useState<any>(null);

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
        user: "Passenger",
        destination: "Central Park, New York, NY",
        pickup: "Times Square, New York, NY",
      });
    }
  }, [location.state]);

  useEffect(() => {
    if (!isLoaded || !map || !rideDetails) return;

    const fetchDirections = async () => {
      const directionsService = new window.google.maps.DirectionsService();
      
      let reqOrigin: any = rideDetails.pickup;
      let reqDest: any = rideDetails.destination;

      // If heading to pickup, navigate from Driver GPS to User Pickup
      if (status === "picking_up") {
        if (!driverLoc) return; // Wait until GPS acquires to render the navigation line!
        reqOrigin = driverLoc;
        reqDest = rideDetails.pickup;
      } 
      // If heading to dropoff, navigate from User Pickup to User Dropoff
      else if (status === "in_transit") {
        reqOrigin = rideDetails.pickup;
        reqDest = rideDetails.destination;
      }

      if (reqOrigin === "Current Location") reqOrigin = "New York, NY";
      if (reqDest === "Unknown Destination") reqDest = "Central Park, NY";

      try {
        const results = await directionsService.route({
          origin: reqOrigin,
          destination: reqDest,
          travelMode: window.google.maps.TravelMode.DRIVING,
        });
        setDirectionsResponse(results);
        if (map && results.routes[0]?.bounds) {
          map.fitBounds(results.routes[0].bounds);
        }
      } catch (err) {
        console.warn("Directions failed", err);
        map?.setCenter({ lat: 40.7128, lng: -74.0060 });
        map?.setZoom(12);
      }
    };

    fetchDirections();
  }, [isLoaded, map, rideDetails, status, driverLoc !== null]);

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
      presentAlert({
        header: "Ride Completed",
        message: `Fare collected: $${rideDetails?.price || "25.00"}\nRate the rider?`,
        buttons: [
          {
            text: "Done",
            handler: () => {
              history.push("/driver/home");
            },
          },
        ],
      });
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
              center={driverLoc || { lat: 40.7128, lng: -74.006 }}
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
      </IonContent>
    </IonPage>
  );
};

export default DriverActiveRide;
