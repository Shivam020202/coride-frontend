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
import { locateOutline, searchOutline } from "ionicons/icons";
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
import SedanIcon from "../assets/sedan.png";
import SuvIcon from "../assets/Suv.png";

const libraries: "places"[] = ["places"];

// Suppress Google Maps auth failure popups
(window as any).gm_authFailure = () => {
  console.warn("Google Maps Auth Failure — billing may be disabled.");
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Home: React.FC = () => {
  const history = useHistory();
  const [showRideOptions, setShowRideOptions] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [user, setUser] = useState<any>(null);
  const [presentToast] = useIonToast();

  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const res = await axios.get(`${apiUrl}/auth/me`, {
          headers: { "x-auth-token": token },
        });
        setUser(res.data);

        socket.connect();
        const userId = res.data._id || res.data.id;
        if (userId) {
          const registerPayload = { userId, role: "consumer" };
          if (socket.connected) socket.emit("register", registerPayload);
          socket.on("connect", () => socket.emit("register", registerPayload));
        }
      } catch (err) {
        console.error("Error fetching user data", err);
      }
    };
    fetchUser();
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
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLoc, setIsGettingLoc] = useState(false);
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");

  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);

  const onLoad = useCallback((map: google.maps.Map) => setMap(map), []);
  const onUnmount = useCallback(() => setMap(null), []);

  useEffect(() => {
    if (map && userLoc) {
      map.panTo(userLoc);
      map.setZoom(16);
    }
  }, [map, userLoc]);

  const getCurrentLocation = async () => {
    setIsGettingLoc(true);
    try {
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          if (result.state === "denied") {
            presentToast({
              message: "Location access is blocked. Please enable it in your browser/phone Settings.",
              duration: 4000,
              color: "danger",
            });
            setLocationGranted(false);
            setIsGettingLoc(false);
            return;
          }
        } catch {}
      }

      try {
        const cap = await Geolocation.checkPermissions();
        if (cap.location !== "granted") {
          const requested = await Geolocation.requestPermissions();
          if (requested.location !== "granted") {
            setLocationGranted(false);
            setIsGettingLoc(false);
            return;
          }
        }
      } catch {}

      const loc = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      setUserLoc(loc);
      setMapCenter(loc);
      setLocationGranted(true);
      map?.panTo(loc);
      map?.setZoom(16);

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
      setLocationGranted(false);
      if (err?.code === 1) {
        presentToast({
          message: "Location denied. Please allow location access in Settings to book rides.",
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

  useEffect(() => {
    getCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function calculateRoute() {
    if (!locationGranted) {
      presentToast({
        message: "Location permission is required to calculate and book rides.",
        duration: 3000,
        color: "warning",
      });
      getCurrentLocation();
      return;
    }
    if (!originRef.current?.value || !destRef.current?.value) return;
    const directionsService = new window.google.maps.DirectionsService();

    setPickupLocation(originRef.current.value);
    setDropoffLocation(destRef.current.value);

    try {
      const results = await directionsService.route({
        origin: originRef.current.value,
        destination: destRef.current.value,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });
      setDirectionsResponse(results);
      setDistance(results.routes[0].legs[0].distance?.text || "");
      setDuration(results.routes[0].legs[0].duration?.text || "");

      const distanceInKm = (results.routes[0].legs[0].distance?.value || 0) / 1000;
      setFare(parseFloat((distanceInKm * 1.5 + 3.0).toFixed(2)));
      setShowRideOptions(true);
    } catch (err) {
      console.error("Error calculating directions", err);
      presentToast({ message: "Could not find a route. Check your addresses.", duration: 3000, color: "warning" });
    }
  }

  const bookRide = (rideType: "coride_x" | "premium") => {
    if (!locationGranted) {
      presentToast({ message: "Location permission is required to book a ride.", duration: 2000, color: "danger" });
      return;
    }
    if (!user) {
      presentToast({ message: "User not loaded", duration: 2000, color: "danger" });
      return;
    }
    if (!pickupLocation || !dropoffLocation) {
      presentToast({ message: "Please enter pickup and destination.", duration: 2000, color: "warning" });
      return;
    }

    setIsBooking(true);
    const riderId = user._id || user.id;

    const rideData = {
      userId: riderId,
      user: user.name,
      pickup: pickupLocation,
      destination: dropoffLocation,
      distance,
      duration,
      price: rideType === "premium" ? parseFloat((fare! * 1.8).toFixed(2)) : fare,
      rideType,
      womenOnly,
    };

    socket.emit("requestRide", rideData);

    const onRideAccepted = (activeRideData: any) => {
      setIsBooking(false);
      presentToast({ message: "Driver accepted your ride!", duration: 3000, color: "success" });

      history.push({
        pathname: "/active-ride",
        state: {
          rideId: activeRideData.id,
          origin: activeRideData.pickup || rideData.pickup,
          destination: activeRideData.destination || rideData.destination,
          distance: activeRideData.distance || distance,
          duration: activeRideData.time || duration,
          price: activeRideData.price || fare,
          driverName: activeRideData.driverName,
          driverCar: activeRideData.driverCar,
          driverLicense: activeRideData.driverLicense,
          driverRating: activeRideData.driverRating,
          driverImg: activeRideData.driverImg,
        },
      });
      socket.off("rideAccepted", onRideAccepted);
    };

    socket.on("rideAccepted", onRideAccepted);

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
          style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0 }}
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
            {directionsResponse && <DirectionsRenderer directions={directionsResponse} />}
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
                {getGreeting()}, {user?.name ? user.name.split(" ")[0] : "there"}
              </h2>

              {!locationGranted && locationGranted !== null ? (
                <div style={{ padding: "16px", textAlign: "center", border: "1px solid #ff4d4d", borderRadius: "8px", marginBottom: "16px", backgroundColor: "#fff0f0" }}>
                  <h3 style={{ color: "#d32f2f", margin: "0 0 8px 0", fontSize: "16px" }}>Location Required</h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#555" }}>
                    Location access is strictly required to book a ride. Please enable it to continue.
                  </p>
                  <IonButton fill="outline" color="danger" size="small" onClick={getCurrentLocation}>
                    Enable Location
                  </IonButton>
                </div>
              ) : null}

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
                    {isGettingLoc ? <IonSpinner name="dots" /> : <IonIcon icon={locateOutline} />}
                  </IonButton>
                </div>
                <Autocomplete>
                  <input
                    type="text"
                    placeholder="Where to?"
                    ref={destRef}
                    className="custom-input bottom-input"
                    onBlur={() => {
                      if (destRef.current?.value) calculateRoute();
                    }}
                  />
                </Autocomplete>
                <IonButton onClick={calculateRoute} className="go-btn" expand="block" disabled={!locationGranted}>
                  <IonIcon icon={searchOutline} slot="start" />
                  Search Route
                </IonButton>
              </div>
            </div>
          ) : (
            <div className="ride-options-container">
              <div className="drag-handle" onClick={() => setShowRideOptions(false)} />

              {isBooking ? (
                <div className="booking-loader">
                  <IonSpinner name="crescent" color="dark" className="booking-spinner" />
                  <h3>{womenOnly ? "Finding a female driver..." : "Connecting you to a driver..."}</h3>
                  <p>This should just take a moment</p>
                </div>
              ) : (
                <>
                  <div className="route-summary">
                    <p>
                      Distance: <strong>{distance}</strong> &bull; Time: <strong>{duration}</strong>
                    </p>
                  </div>

                  <label className="women-only-toggle" htmlFor="women-only-cb">
                    <span className="women-only-icon">&#9792;</span>
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
                    <IonItem lines="none" className="ride-item selected" onClick={() => bookRide("coride_x")}>
                      <img
                        slot="start"
                        src={SedanIcon}
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

                    <IonItem lines="none" className="ride-item" onClick={() => bookRide("premium")}>
                      <img
                        slot="start"
                        src={SuvIcon}
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
                    <IonButton expand="block" className="book-btn" onClick={() => bookRide("coride_x")}>
                      {womenOnly ? "Confirm Women-Only Ride" : "Confirm CoRide X"}
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
