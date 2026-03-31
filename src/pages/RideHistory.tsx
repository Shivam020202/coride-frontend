import React from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
} from "@ionic/react";
import { star, locationOutline, checkmarkCircle } from "ionicons/icons";
import axios from "axios";
import "./RideHistory.css";

const RideHistory: React.FC = () => {
  const [rides, setRides] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRides = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl =
          import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const res = await axios.get(`${apiUrl}/rides/history`, {
          headers: { "x-auth-token": token },
        });
        setRides(res.data);
      } catch (err) {
        console.error("Error fetching rides:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, []);

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="premium-header-bg">
          <IonTitle className="premium-title">Activity</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="history-bg">
        <div className="section-title">Past trips</div>

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "30px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <IonList lines="none" className="history-list">
            {rides.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "20px", color: "#666" }}
              >
                No rides yet. Your completed trips will appear here.
              </div>
            ) : (
              rides.map((ride, idx) => (
                <IonItem
                  button
                  detail={false}
                  className="history-item"
                  key={ride.id || idx}
                >
                  <div className="history-icon-box bg-blue-light" slot="start">
                    <IonIcon icon={locationOutline} className="text-brand" />
                  </div>
                  <IonLabel>
                    <h2>{ride.destination}</h2>
                    <p>{formatDate(ride.date)}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span className="car-type">{ride.type}</span>
                      {ride.paymentStatus === "paid" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.7rem", color: "#16a34a", fontWeight: 600 }}>
                          <IonIcon icon={checkmarkCircle} style={{ fontSize: "0.8rem" }} /> Paid
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.7rem", color: "#f59e0b", fontWeight: 600 }}>
                          Pending
                        </span>
                      )}
                    </div>
                  </IonLabel>
                  <div className="price-details" slot="end">
                    <h2>${ride.price.toFixed(2)}</h2>
                    {ride.rating > 0 && (
                      <div className="rating">
                        <span>{ride.rating}</span> <IonIcon icon={star} />
                      </div>
                    )}
                  </div>
                </IonItem>
              ))
            )}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default RideHistory;
