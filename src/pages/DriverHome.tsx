import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  useIonToast,
  IonRefresher,
  IonRefresherContent,
} from "@ionic/react";
import { personCircleOutline, carOutline, timeOutline } from "ionicons/icons";
import axios from "axios";
import { useHistory } from "react-router-dom";
import socket from "../socket";
import "./DriverHome.css";

interface RideRequest {
  id: string;
  user: string;
  pickup: string;
  destination: string;
  price: number;
  distance: string;
  time: string;
}

const DriverHome: React.FC = () => {
  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [present] = useIonToast();
  const history = useHistory();

  useEffect(() => {
    const initDriver = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl =
          import.meta.env.VITE_API_URL || "https://localhost:5000/api";
        const res = await axios.get(`${apiUrl}/auth/me`, {
          headers: { "x-auth-token": token },
        });
        setUser(res.data);

        socket.connect();
        const userId = res.data._id || res.data.id;
        if (userId) {
          const registerPayload = { userId: userId, role: "driver", gender: res.data.gender || "male" };
          console.log("[Driver] Registering with payload:", registerPayload, "connected:", socket.connected);
          // If already connected, emit immediately
          if (socket.connected) {
            socket.emit("register", registerPayload);
          }
          // Listen to reconnects natively so it re-adds to room
          socket.on("connect", () => {
            console.log("[Driver] Socket connected/reconnected, re-registering");
            socket.emit("register", registerPayload);
          });
        }
      } catch (err) {
        console.error("Error fetching user", err);
      }
    };
    initDriver();
  }, []);

  const fetchRequests = async () => {
    if (!online) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl =
        import.meta.env.VITE_API_URL || "https://localhost:5000/api";
      const res = await axios.get(`${apiUrl}/driver/requests`, {
        headers: { "x-auth-token": token },
      });
      setRequests(res.data);
    } catch (err: any) {
      console.error(err);
      present({
        message: "Failed to fetch requests",
        duration: 2000,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only bind listeners when we toggle online
    if (online) {
      const handleNewReq = (req: RideRequest) => {
        console.log("[Driver] newRideRequest received:", req);
        setRequests((prev) => [...prev, req]);
        present({
          message: "New ride request!",
          duration: 2000,
          color: "primary",
        });
      };

      const handleRemoveReq = (reqId: string) => {
        setRequests((prev) => prev.filter((r) => r.id !== reqId));
      };

      const handleSuccess = (activeRide: any) => {
        present({
          message: "Ride accepted! Starting navigation...",
          duration: 2000,
          color: "success",
        });
        history.push({
          pathname: "/driver/active-ride",
          state: { activeRide },
        });
      };

      socket.on("newRideRequest", handleNewReq);
      socket.on("removeRideRequest", handleRemoveReq);
      socket.on("rideAcceptSuccess", handleSuccess);

      // Clean up cleanly on dependency change
      return () => {
        socket.off("newRideRequest", handleNewReq);
        socket.off("removeRideRequest", handleRemoveReq);
        socket.off("rideAcceptSuccess", handleSuccess);
      };
    } else {
      setRequests([]);
    }
  }, [online, present, history]);

  const toggleStatus = () => {
    setOnline(!online);
    if (online) {
      setRequests([]);
    }
  };

  const handleRefresh = (event: CustomEvent) => {
    if (online) fetchRequests().then(() => event.detail.complete());
    else event.detail.complete();
  };

  const acceptRequest = async (id: string) => {
    if (!user) return;
    const driverId = user._id || user.id;
    socket.emit("acceptRide", { 
      requestId: id, 
      driverId,
      driverName: user.name,
      driverCar: "Black Toyota Camry",
      driverLicense: "XCV 456",
      driverRating: "4.9 ★",
      driverImg: "https://minhas-avatars.s3.amazonaws.com/default.png"
    });
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Driver Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="driver-home-content">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="driver-dashboard">
          <div className="driver-status-card">
            <h2>{online ? "You are Online" : "You are Offline"}</h2>
            <IonButton
              expand="block"
              className="status-toggle"
              color={online ? "danger" : "success"}
              onClick={toggleStatus}
            >
              {online ? "GO OFFLINE" : "GO ONLINE"}
            </IonButton>
            {!online && (
              <p className="offline-text">
                Go online to start receiving ride requests.
              </p>
            )}
          </div>

          {online && (
            <div className="requests-section">
              <h3 className="requests-header">Incoming Requests</h3>
              {loading ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <IonSpinner name="crescent" />
                </div>
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <div key={req.id} className="request-card">
                    <div className="request-header">
                      <div className="request-user">
                        <IonIcon icon={personCircleOutline} size="large" />
                        <span>{req.user}</span>
                      </div>
                      <div className="request-price">
                        ${req.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="request-details">
                      <div className="request-route">
                        <div className="request-point pickup">{req.pickup}</div>
                        <div className="request-point dropoff">
                          {req.destination}
                        </div>
                      </div>
                      <div className="request-meta">
                        <span>
                          <IonIcon icon={carOutline} /> {req.distance}
                        </span>
                        <span>
                          <IonIcon icon={timeOutline} /> {req.time}
                        </span>
                      </div>
                    </div>
                    <div className="request-actions">
                      <IonButton
                        color="medium"
                        fill="outline"
                        onClick={() => present("Request dismissed", 1000)}
                      >
                        Decline
                      </IonButton>
                      <IonButton
                        color="dark"
                        onClick={() => acceptRequest(req.id)}
                      >
                        Accept
                      </IonButton>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-requests">
                  <p>Searching for nearby rides...</p>
                  <IonSpinner name="dots" />
                </div>
              )}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DriverHome;
