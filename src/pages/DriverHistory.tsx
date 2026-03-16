import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  useIonToast,
  IonIcon,
} from "@ionic/react";
import { checkmarkCircle } from "ionicons/icons";
import axios from "axios";
import "./DriverHistory.css";

interface HistoryItem {
  id: string;
  user: string;
  destination: string;
  date: string;
  earnings: number;
}

const DriverHistory: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [present] = useIonToast();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl =
          import.meta.env.VITE_API_URL || "https://localhost:5000/api";
        const res = await axios.get(`${apiUrl}/driver/history`, {
          headers: { "x-auth-token": token },
        });
        setHistory(res.data.history);
        setTotalEarnings(res.data.totalEarnings);
      } catch (err) {
        present({
          message: "Failed to load history",
          duration: 2000,
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Earnings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="driver-history-content">
        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            <div className="earnings-summary">
              <h3>This Week</h3>
              <h1 className="earnings-amount">${totalEarnings.toFixed(2)}</h1>
            </div>

            <div className="history-list">
              <h3 style={{ margin: "1rem 0", color: "#333", fontWeight: 700 }}>
                Past Trips
              </h3>
              {history.map((item) => (
                <div key={item.id} className="history-card">
                  <div className="history-card-header">
                    <span className="history-date">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    <span className="history-earnings">
                      +${item.earnings.toFixed(2)}
                    </span>
                  </div>
                  <div className="history-route">
                    <IonIcon icon={checkmarkCircle} color="success" />
                    <div className="history-details">
                      <p className="history-user">{item.user}</p>
                      <p className="history-desc">
                        Drop-off: {item.destination}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p style={{ textAlign: "center", color: "#666" }}>
                  No trips completed yet.
                </p>
              )}
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default DriverHistory;
