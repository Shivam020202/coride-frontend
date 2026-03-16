import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonAvatar,
  IonButton,
  IonSpinner,
  IonIcon,
  IonLabel,
  IonList,
  IonItem,
  useIonToast,
} from "@ionic/react";
import axios from "axios";
import { time, locateOutline } from "ionicons/icons";
import { Geolocation } from "@capacitor/geolocation";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
  Autocomplete,
} from "@react-google-maps/api";
import socket from "../socket";
import "./Home.css";

const libraries: "places"[] = ["places"];

// Create a safe override to suppress the default Google Maps Error popup alerts!
(window as any).gm_authFailure = () => {
  console.warn(
    "Google Maps Auth Failure (Billing likely disabled). Please enable billing to use Places API correctly.",
  );
};

const Home: React.FC = () => {
  const history = useHistory();
  const [showRideOptions, setShowRideOptions] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [user, setUser] = useState<any>(null);
  const [presentToast] = useIonToast();

  // Check & silently re-request location permission when Home mounts
  useEffect(() => {
    const checkLocationPermission = async () => {
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: "geolocation" });
          if (result.state === "prompt") {
            // Silently trigger permission dialog via a quick getCurrentPosition
            navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 3000 });
          }
        }
      } catch {
        // Permissions API not available on this browser — no-op
      }
    };
    checkLocationPermission();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl =
          import.meta.env.VITE_API_URL || "https://localhost:5000/api";
        const res = await axios.get(`${apiUrl}/auth/me`, {
          headers: { "x-auth-token": token },
        });
        setUser(res.data);

        // Connect socket and register rider
        socket.connect();
        const userId = res.data._id || res.data.id;
        if (userId) {
          const registerPayload = { userId: userId, role: "consumer" };
          if (socket.connected) {
            socket.emit("register", registerPayload);
          }
          socket.on("connect", () => {
            socket.emit("register", registerPayload);
          });
        }
      } catch (err) {
        console.error("Error fetching user data", err);
      }
    };
    fetchUser();

    // We don't disconnect the socket here to keep the connection alive
    // across strict mode remounts, it will handle auto-reconnects
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.006 });

  const [directionsResponse, setDirectionsResponse] =
    useState<google.maps.DirectionsResult | null>(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [fare, setFare] = useState<number | null>(null);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [isGettingLoc, setIsGettingLoc] = useState(false);

  /** @type React.MutableRefObject<HTMLInputElement> */
  const originRef = useRef<HTMLInputElement>(null);
  /** @type React.MutableRefObject<HTMLInputElement> */
  const destRef = useRef<HTMLInputElement>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const getCurrentLocation = async () => {
    setIsGettingLoc(true);
    try {
      // Step 1 — Check current permission state via browser Permissions API
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          if (result.state === "denied") {
            presentToast({
              message:
                "Location access is blocked. Please enable it in your browser/phone Settings and try again.",
              duration: 4000,
              color: "danger",
            });
            setIsGettingLoc(false);
            return;
          }
        } catch {
          // Permissions API unavailable — continue and let geolocation itself handle it
        }
      }

      // Step 2 — Also try Capacitor (re-requests permission if needed on native)
      try {
        const cap = await Geolocation.checkPermissions();
        if (cap.location !== "granted") {
          await Geolocation.requestPermissions();
        }
      } catch {
        // Capacitor not available in browser context — fall through to native API
      }

      // Step 3 — Get position via browser-native geolocation (most reliable on mobile PWA)
      const loc = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      setUserLoc(loc);
      setMapCenter(loc);
      map?.panTo(loc);
      map?.setZoom(16);

      // Step 4 — Reverse geocode to fill the pickup input
      try {
        const geocoder = new window.google.maps.Geocoder();
        const response = await geocoder.geocode({ location: loc });
        if (response.results[0] && originRef.current) {
          originRef.current.value = response.results[0].formatted_address;
        }
      } catch {
        if (originRef.current) {
          originRef.current.value = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
        }
      }
    } catch (err: any) {
      console.error("Error getting location", err);
      // GeolocationPositionError codes: 1=PERMISSION_DENIED, 2=UNAVAILABLE, 3=TIMEOUT
      if (err?.code === 1) {
        presentToast({
          message:
            "Location denied. Please allow location access in your browser or phone Settings.",
          duration: 4000,
          color: "danger",
        });
      } else {
        presentToast({
          message: "Could not get your location. Please try again.",
          duration: 3000,
          color: "warning",
        });
      }
    } finally {
      setIsGettingLoc(false);
    }
  };

  async function calculateRoute() {
    if (originRef.current?.value === "" || destRef.current?.value === "") {
      return;
    }
    const directionsService = new window.google.maps.DirectionsService();
    try {
      const results = await directionsService.route({
        origin: originRef.current!.value,
        destination: destRef.current!.value,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });
      setDirectionsResponse(results);
      setDistance(results.routes[0].legs[0].distance?.text || "");
      setDuration(results.routes[0].legs[0].duration?.text || "");

      // Basic fare estimation based on distance
      const distanceInKm =
        (results.routes[0].legs[0].distance?.value || 0) / 1000;
      setFare(parseFloat((distanceInKm * 1.5 + 3.0).toFixed(2))); // Base fare = 3.0, per km = 1.5

      setShowRideOptions(true);
    } catch (err) {
      console.error("Error calculating directions", err);
    }
  }

  const bookRide = () => {
    if (!user) {
      presentToast({
        message: "User not loaded",
        duration: 2000,
        color: "danger",
      });
      return;
    }

    setIsBooking(true);

    const riderId = user._id || user.id;

    // Read input values - these are plain <input> refs inside <Autocomplete>
    const pickupText = originRef.current?.value?.trim();
    const destText = destRef.current?.value?.trim();

    const rideData = {
      userId: riderId,
      user: user.name,
      pickup: pickupText || "Times Square, New York, NY",
      destination: destText || "Central Park, New York, NY",
      distance,
      duration,
      price: fare,
      womenOnly,
    };

    console.log("[Rider] Emitting requestRide:", rideData);

    // Request ride
    socket.emit("requestRide", rideData);

    const onRideAccepted = (activeRideData: any) => {
      console.log("[Rider] rideAccepted received:", activeRideData);
      setIsBooking(false);
      presentToast({
        message: "Driver accepted your ride!",
        duration: 3000,
        color: "success",
      });

      history.push({
        pathname: "/active-ride",
        state: {
          rideId: activeRideData.id,
          origin: activeRideData.pickup || rideData.pickup,
          destination: activeRideData.destination || rideData.destination,
          distance: activeRideData.distance || distance,
          duration: activeRideData.time || duration,
          driverName: activeRideData.driverName || "Your Driver",
          driverCar: activeRideData.driverCar || "Black Toyota Camry",
          driverLicense: activeRideData.driverLicense || "XCV 456",
          driverRating: activeRideData.driverRating || "4.9 ★",
          driverImg: activeRideData.driverImg || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
        },
      });
      socket.off("rideAccepted", onRideAccepted);
    };

    // Listen for accepted ride
    socket.on("rideAccepted", onRideAccepted);

    // Safety fallback — increase to 5 minutes so the driver has time to accept
    setTimeout(() => {
      setIsBooking(false);
      socket.off("rideAccepted", onRideAccepted);
    }, 300000);
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <IonSpinner />;

  return (
    <IonPage id="main-content">
      <IonHeader className="ion-no-border">
        <IonToolbar className="home-toolbar">
          <div className="toolbar-content">
            <h1 className="brand-logo-small">CoRide.</h1>
            <IonAvatar
              className="profile-btn-small"
              onClick={() => history.push("/tabs/profile")}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "U")}&background=random`}
                alt="Profile"
              />
            </IonAvatar>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="home-content">
        <div
          className="map-wrapper"
          style={{
            height: "100%",
            width: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          <GoogleMap
            mapContainerStyle={{
              width: "100%",
              height: showRideOptions ? "50vh" : "100%",
            }}
            center={mapCenter}
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
            {!directionsResponse && !userLoc && <Marker position={mapCenter} />}
            {directionsResponse && (
              <DirectionsRenderer directions={directionsResponse} />
            )}
            {userLoc && (
              <Marker
                position={userLoc}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#4285F4",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#ffffff",
                }}
              />
            )}
          </GoogleMap>
          <div className="top-gradient-overlay" />
        </div>

        <div className={`bottom-sheet ${showRideOptions ? "expanded" : ""}`}>
          {!showRideOptions ? (
            <div className="search-container">
              <h2 className="greeting">
                Good afternoon, {user?.name ? user.name.split(" ")[0] : "Rider"}
              </h2>

              <div className="route-inputs">
                <div className="input-with-icon">
                  <Autocomplete>
                    <input
                      type="text"
                      placeholder="Pickup location"
                      ref={originRef}
                      className="custom-input top-input"
                    />
                  </Autocomplete>
                  <IonButton
                    fill="clear"
                    className="location-btn"
                    onClick={getCurrentLocation}
                    disabled={isGettingLoc}
                  >
                    {isGettingLoc ? (
                      <IonSpinner name="dots" />
                    ) : (
                      <IonIcon icon={locateOutline} />
                    )}
                  </IonButton>
                </div>
                <Autocomplete>
                  <input
                    type="text"
                    placeholder="Where to?"
                    ref={destRef}
                    className="custom-input bottom-input"
                    onBlur={() => {
                      if (destRef.current?.value) {
                        calculateRoute();
                      }
                    }}
                  />
                </Autocomplete>
                <IonButton
                  onClick={calculateRoute}
                  className="go-btn"
                  expand="block"
                >
                  Search Route
                </IonButton>
              </div>

              <div className="recent-places">
                <IonItem
                  lines="none"
                  detail={false}
                  className="recent-item"
                  onClick={() => {
                    if (destRef.current)
                      destRef.current.value = "Times Square, New York, NY";
                    calculateRoute();
                  }}
                >
                  <div slot="start" className="icon-bg bg-blue-light">
                    <IonIcon icon={time} className="text-brand" />
                  </div>
                  <IonLabel>
                    <h3>Home</h3>
                    <p>Times Square</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  lines="none"
                  detail={false}
                  className="recent-item"
                  onClick={() => {
                    if (destRef.current)
                      destRef.current.value = "Central Park, New York, NY";
                    calculateRoute();
                  }}
                >
                  <div slot="start" className="icon-bg bg-blue-light">
                    <IonIcon icon={time} className="text-brand" />
                  </div>
                  <IonLabel>
                    <h3>Central Park</h3>
                    <p>New York, NY</p>
                  </IonLabel>
                </IonItem>
              </div>
            </div>
          ) : (
            <div className="ride-options-container">
              <div
                className="drag-handle"
                onClick={() => setShowRideOptions(false)}
              ></div>

              {isBooking ? (
                <div className="booking-loader">
                  <IonSpinner
                    name="crescent"
                    color="dark"
                    className="booking-spinner"
                  />
                  <h3>{womenOnly ? "Finding a female driver..." : "Connecting you to a driver..."}</h3>
                  <p>This should just take a moment</p>
                </div>
              ) : (
                <>
                  <div className="route-summary">
                    <p>
                      Distance: <strong>{distance}</strong> • Time:{" "}
                      <strong>{duration}</strong>
                    </p>
                  </div>

                  {/* Women drivers only toggle */}
                  <label className="women-only-toggle" htmlFor="women-only-cb">
                    <span className="women-only-icon">♀</span>
                    <span className="women-only-label">
                      <strong>Women drivers only</strong>
                      <small>Your ride will go to female drivers</small>
                    </span>
                    <div className={`women-only-switch ${womenOnly ? "on" : ""}`}>
                      <input
                        id="women-only-cb"
                        type="checkbox"
                        checked={womenOnly}
                        onChange={(e) => setWomenOnly(e.target.checked)}
                      />
                      <span className="women-only-knob" />
                    </div>
                  </label>

                  <h3 className="options-title">Choose a ride</h3>

                  <IonList className="ride-list">
                    <IonItem
                      lines="none"
                      className="ride-item selected"
                      onClick={bookRide}
                    >
                      <img
                        slot="start"
                        src="https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_637/v1555367310/assets/30/51e602-10bb-4e65-b122-e394d80a1c97/original/UberX_Transparent.png"
                        className="car-icon"
                        alt="CoRide X"
                      />
                      <IonLabel className="ride-label">
                        <h2>CoRide X</h2>
                        <p className="eta-text">{duration} away</p>
                      </IonLabel>
                      <div slot="end" className="price-info">
                        <h3>${fare}</h3>
                      </div>
                    </IonItem>

                    <IonItem
                      lines="none"
                      className="ride-item"
                      onClick={bookRide}
                    >
                      <img
                        slot="start"
                        src="https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_637/v1555367538/assets/31/ad21b7-595c-42e8-ac53-53966b4a5fee/original/Black_v1.png"
                        className="car-icon"
                        alt="CoRide Premium"
                      />
                      <IonLabel className="ride-label">
                        <h2>Premium</h2>
                        <p className="eta-text">{duration} away</p>
                      </IonLabel>
                      <div slot="end" className="price-info">
                        <h3>${(fare! * 1.8).toFixed(2)}</h3>
                      </div>
                    </IonItem>
                  </IonList>

                  <div className="book-btn-wrapper">
                    <IonButton
                      expand="block"
                      className="book-btn"
                      onClick={bookRide}
                    >
                      {womenOnly ? "Confirm ♀️ Women-Only Ride" : "Confirm CoRide X"}
                    </IonButton>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
