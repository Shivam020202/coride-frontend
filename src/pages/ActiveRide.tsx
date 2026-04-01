import React, { useState, useEffect, useCallback, useRef } from "react";
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
  stopCircle,
  locationOutline,
} from "ionicons/icons";
import {
  GoogleMap,
  useJsApiLoader,
  DirectionsRenderer,
  Marker,
} from "@react-google-maps/api";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import axios from "axios";
import socket from "../socket";
import "./ActiveRide.css";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const libraries: "places"[] = ["places"];

/** Generate a short random token for the share session */
const genToken = () =>
  Math.random().toString(36).substring(2, 10) +
  Math.random().toString(36).substring(2, 10);

// ── Stripe Checkout Form ─────────────────────────────────────────────────────
const CheckoutForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/tabs/home",
      },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message || "Payment failed");
      setProcessing(false);
    } else {
      setProcessing(false);
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "10px 0 0", textAlign: "center" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="rating-submit-btn"
        style={{ marginTop: 16 }}
      >
        {processing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
};

const ActiveRide: React.FC = () => {
  const history = useHistory();
  const location = useLocation<{
    origin: string;
    destination: string;
    distance: string;
    duration: string;
    price?: string;
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
    price: "25.00",
    driverName: "John D.",
    driverCar: "White Toyota Prius",
    driverLicense: "ABC 123",
    driverRating: "4.9 ★",
    driverImg:
      "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80",
  };

  const [rideStatus, setRideStatus] = useState("picking_up");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const token = localStorage.getItem("token");

  // ── Share state ─────────────────────────────────────────────────────────────
  const [isSharing, setIsSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  const locationWatchRef = useRef<number | null>(null);

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

      let reqOrigin: string | google.maps.LatLngLiteral = state.origin;
      let reqDest: string = state.destination;

      // If origin is "Current Location", use the browser's actual GPS
      if (reqOrigin === "Current Location" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
          );
          reqOrigin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
          // GPS failed — fall back to driver location if available
          if (driverLocation) reqOrigin = driverLocation;
        }
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
          if (map) map.fitBounds(results.routes[0].bounds);
        }
      } catch (err) {
        console.error("Error calculating directions in ActiveRide", err);
        if (driverLocation) {
          map?.setCenter(driverLocation);
        }
        map?.setZoom(12);
      }
    };
    if (isLoaded && map) fetchDirections();
  }, [isLoaded, map, state.origin, state.destination]);

  useEffect(() => {
    socket.on("driverLocationUpdate", (loc: { lat: number; lng: number }) => {
      setDriverLocation(loc);
      if (rideStatus === "picking_up") setCarLoc(loc);
    });

    socket.on("rideStatusUpdate", (status: string) => {
      setRideStatus(status);
      if (status === "arrived") {
        present({ message: "Driver has arrived!", duration: 3000, color: "success" });
      } else if (status === "in_transit") {
        present({ message: "Heading to destination!", duration: 3000, color: "primary" });
      } else if (status === "completed") {
        stopSharing();
        // Start payment flow
        initiatePayment();
      }
    });

    return () => {
      socket.off("driverLocationUpdate");
      socket.off("rideStatusUpdate");
    };
  }, [rideStatus, present, history]);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  // ── Share Ride (live location) ───────────────────────────────────────────────
  const startSharing = async () => {
    const token = genToken();
    setShareToken(token);
    setIsSharing(true);

    // Tell backend we're starting a share session
    socket.emit("startSharing", { token });

    // Start watching GPS and broadcasting every position update
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          socket.emit("broadcastLocation", {
            token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => console.warn("Location watch error:", err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      locationWatchRef.current = watchId;
    }

    // Build the shareable tracking URL
    const trackUrl = `${window.location.origin}/track?token=${token}`;
    const shareText =
      `🚗 I'm in a CoRide — track me live!\n\n` +
      `Driver: ${state.driverName} · ${state.driverCar} (${state.driverLicense})\n` +
      `From: ${state.origin}\n` +
      `To: ${state.destination}\n\n` +
      `Live tracking link:\n${trackUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "Track my CoRide", text: shareText, url: trackUrl });
      } else {
        // Fallback — copy to clipboard
        await navigator.clipboard.writeText(shareText);
        present({ message: "Tracking link copied to clipboard!", duration: 3000, color: "success" });
      }
    } catch (err) {
      // User cancelled share — still streaming
    }
  };

  const stopSharing = () => {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    setIsSharing(false);
    setShareToken(null);
  };

  // ── Emergency SOS ────────────────────────────────────────────────────────────
  const triggerSOS = () => {
    setShowEmergencyPanel(false);
    window.location.href = "tel:112";
  };

  const shareEmergency = async () => {
    if (!isSharing) await startSharing();
    else {
      const trackUrl = `${window.location.origin}/track?token=${shareToken}`;
      const msg =
        `🚨 EMERGENCY — I need help!\n` +
        `I'm in a CoRide with ${state.driverName} (${state.driverCar} · ${state.driverLicense})\n` +
        `Live location: ${trackUrl}`;
      if (navigator.share) {
        await navigator.share({ title: "EMERGENCY — track me", text: msg, url: trackUrl });
      } else {
        await navigator.clipboard.writeText(msg);
        present({ message: "Emergency message copied!", duration: 3000, color: "danger" });
      }
    }
    setShowEmergencyPanel(false);
  };

  // ── Payment Flow ─────────────────────────────────────────────────────────
  const initiatePayment = async () => {
    const price = parseFloat(state.price || "25.00");
    setPaymentLoading(true);
    try {
      const res = await axios.post(
        `${apiUrl}/payment/create-payment-intent`,
        { amount: price, rideId: (state as any).rideId || "" },
        { headers: { "x-auth-token": token } }
      );
      setPaymentClientSecret(res.data.clientSecret);
      setPaymentIntentId(res.data.paymentIntentId);
      setShowPaymentModal(true);
    } catch (err) {
      console.error("Payment intent failed:", err);
      present({ message: "Payment setup failed. Please try again.", duration: 3000, color: "danger" });
      // Still show rating even if payment fails
      setShowRatingModal(true);
    } finally {
      setPaymentLoading(false);
    }
  };

  const onPaymentSuccess = async () => {
    // Confirm payment on backend
    try {
      await axios.post(
        `${apiUrl}/payment/confirm-payment`,
        { paymentIntentId, rideId: (state as any).rideId || "" },
        { headers: { "x-auth-token": token } }
      );
    } catch (err) {
      console.error("Payment confirmation error:", err);
    }
    setShowPaymentModal(false);
    setPaymentClientSecret(null);
    present({ message: "Payment successful!", duration: 2000, color: "success" });
    // Now show rating
    setShowRatingModal(true);
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
          {/* Live sharing badge in toolbar */}
          {isSharing && (
            <IonButtons slot="end">
              <div className="live-badge">
                <span className="live-dot" />
                LIVE
              </div>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ride-content-bg">
        {/* Full-screen map */}
        <div
          className="ride-map-fullscreen"
          style={{ position: "absolute", width: "100%", height: "55vh", top: 0, left: 0 }}
        >
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={carLoc || driverLocation || undefined}
              zoom={14}
              options={{ zoomControl: false, streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
              onLoad={onLoad}
              onUnmount={onUnmount}
            >
              {directionsResponse && (
                <DirectionsRenderer
                  directions={directionsResponse}
                  options={{ suppressMarkers: false, polylineOptions: { strokeColor: "#1e3a8a", strokeWeight: 5 } }}
                />
              )}
              {carLoc && customCarIcon.scaledSize && (
                <Marker position={carLoc} icon={customCarIcon as google.maps.Icon} />
              )}
            </GoogleMap>
          )}
        </div>

        {/* Bottom sheet */}
        <div className="ride-bottom-sheet">
          <div className="sheet-pill" />

          <div className="ride-sheet-content">
            {/* Header: status + ETA */}
            <div className="ride-header">
              <div>
                <h2 className="ride-status-text">
                  {rideStatus === "arrived"
                    ? "Driver arrived"
                    : rideStatus === "in_transit"
                      ? "Heading to destination"
                      : "Driver is heading to you"}
                </h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontWeight: 500, fontSize: "0.95rem" }}>
                  {rideStatus === "in_transit" ? "" : state.distance || "1.2 mi"} away
                </p>
              </div>
              <div className="ride-eta-box">
                <span className="ride-time">{state.duration || "4 min"}</span>
              </div>
            </div>

            {/* Driver card */}
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

            {/* Actions row */}
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

              {/* Share / Stop sharing */}
              <div className="action-circle">
                {isSharing ? (
                  <IonButton
                    fill="clear"
                    className="circle-btn bg-sharing"
                    onClick={stopSharing}
                  >
                    <IonIcon icon={stopCircle} color="light" />
                  </IonButton>
                ) : (
                  <IonButton
                    fill="clear"
                    className="circle-btn bg-brand"
                    onClick={startSharing}
                  >
                    <IonIcon icon={shareSocial} color="light" />
                  </IonButton>
                )}
                <span className={isSharing ? "text-sharing" : "text-brand"}>
                  {isSharing ? "Stop" : "Share"}
                </span>
              </div>

              {/* Safety / SOS */}
              <div className="action-circle">
                <IonButton
                  fill="clear"
                  className="circle-btn bg-danger-soft"
                  onClick={() => setShowEmergencyPanel(true)}
                >
                  <IonIcon icon={shieldCheckmark} color="danger" />
                </IonButton>
                <span className="text-red">Safety</span>
              </div>
            </div>

            {/* Active sharing banner */}
            {isSharing && (
              <div className="sharing-banner">
                <IonIcon icon={locationOutline} className="sharing-banner-icon" />
                <div className="sharing-banner-text">
                  <strong>Sharing live location</strong>
                  <p>Your contacts can track you in real-time</p>
                </div>
                <button className="sharing-resend-btn" onClick={startSharing}>
                  Reshare
                </button>
              </div>
            )}
          </div>
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
              <p className="rating-fare">${state.price || "25.00"}</p>
              <p className="rating-subtitle">How was your ride with {state.driverName}?</p>

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
                {rating === 0 ? "Tap to rate" : rating <= 2 ? "We're sorry to hear that" : rating <= 3 ? "Thanks for riding" : rating === 4 ? "Great ride!" : "Excellent!"}
              </p>

              <button
                className="rating-submit-btn"
                disabled={rating === 0}
                onClick={() => {
                  present({
                    message: `You rated ${state.driverName} ${rating} star${rating > 1 ? "s" : ""}. Thanks!`,
                    duration: 2500,
                    color: "success",
                  });
                  setShowRatingModal(false);
                  history.replace("/tabs/home");
                }}
              >
                Submit Rating
              </button>

              <button
                className="rating-skip-btn"
                onClick={() => {
                  setShowRatingModal(false);
                  history.replace("/tabs/home");
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Payment loading overlay */}
        {paymentLoading && (
          <div className="rating-overlay">
            <div className="rating-panel" style={{ padding: "48px 28px" }}>
              <IonSpinner name="crescent" style={{ marginBottom: 16 }} />
              <h2 className="rating-title" style={{ fontSize: "1.2rem" }}>Preparing Payment...</h2>
              <p className="rating-subtitle">Setting up secure checkout</p>
            </div>
          </div>
        )}

        {/* Stripe Payment Modal */}
        {showPaymentModal && paymentClientSecret && stripePromise && (
          <div className="rating-overlay">
            <div className="rating-panel payment-modal-panel">
              <div className="rating-checkmark">
                <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#18181b" />
                  <path d="M15 24.5L21 30.5L33 18.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="rating-title">Ride Complete!</h2>
              <p className="rating-fare">${state.price || "25.00"}</p>

              <div className="payment-details-row">
                <span>Ride fare</span>
                <span>${state.price || "25.00"}</span>
              </div>
              <div className="payment-details-row" style={{ borderBottom: "none", fontWeight: 700, color: "#0f172a" }}>
                <span>Total</span>
                <span>${state.price || "25.00"}</span>
              </div>

              <div style={{ margin: "16px 0 12px", textAlign: "left" }}>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: paymentClientSecret,
                    appearance: {
                      theme: "stripe",
                      variables: {
                        colorPrimary: "#18181b",
                        borderRadius: "12px",
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                      },
                    },
                  }}
                >
                  <CheckoutForm onSuccess={onPaymentSuccess} />
                </Elements>
              </div>
            </div>
          </div>
        )}

        {/* Emergency modal overlay */}
        {showEmergencyPanel && (
          <div className="emergency-overlay" onClick={() => setShowEmergencyPanel(false)}>
            <div className="emergency-panel" onClick={(e) => e.stopPropagation()}>
              <div className="emergency-panel-header">
                <span className="emergency-icon-large">🚨</span>
                <h2>Emergency Safety</h2>
                <button className="emergency-close-btn" onClick={() => setShowEmergencyPanel(false)}>✕</button>
              </div>

              <p className="emergency-subtitle">
                Choose an action. Your ride details will be shared automatically.
              </p>

              {/* Ride info summary */}
              <div className="emergency-ride-info">
                <div className="eri-row"><span>Driver</span><strong>{state.driverName}</strong></div>
                <div className="eri-row"><span>Vehicle</span><strong>{state.driverCar}</strong></div>
                <div className="eri-row"><span>Plate</span><strong>{state.driverLicense}</strong></div>
              </div>

              <button className="sos-btn" onClick={triggerSOS}>
                <span className="sos-icon">📞</span>
                Call Emergency (112)
              </button>

              <button className="emergency-share-btn" onClick={shareEmergency}>
                <span>📍</span>
                Share Live Location + Ride Details
              </button>

              <p className="emergency-note">
                Tapping "Share" opens your phone's share sheet (WhatsApp, SMS, etc.) with your live tracking link and full ride info.
              </p>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActiveRide;

