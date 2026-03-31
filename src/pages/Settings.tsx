import React from "react";
import { useHistory } from "react-router-dom";
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
  IonButtons,
  IonBackButton,
  IonSpinner,
} from "@ionic/react";
import axios from "axios";
import {
  personOutline,
  mailOutline,
  lockClosedOutline,
  notificationsOutline,
  locationOutline,
  logOutOutline,
} from "ionicons/icons";
import "./Settings.css";

const Settings: React.FC = () => {
  const history = useHistory();
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const res = await axios.get(`${apiUrl}/auth/me`, {
          headers: { "x-auth-token": token },
        });
        setUser(res.data);
      } catch (err) {
        console.error("Error fetching user data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    history.push("/login");
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="settings-header">
          <IonButtons slot="start">
            <IonBackButton text="" color="dark" defaultHref="/tabs/profile" />
          </IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="settings-bg">
        <div className="settings-section">
          <h2>Account Details</h2>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <IonList className="settings-list" lines="full">
              <IonItem className="settings-item">
                <IonIcon icon={personOutline} slot="start" />
                <IonLabel>
                  <h3>{user?.name || "Name not set"}</h3>
                  <p>Name</p>
                </IonLabel>
              </IonItem>
              <IonItem className="settings-item">
                <IonIcon icon={mailOutline} slot="start" />
                <IonLabel>
                  <h3>{user?.email || "Email not set"}</h3>
                  <p>Email</p>
                </IonLabel>
              </IonItem>
              <IonItem className="settings-item">
                <IonIcon icon={lockClosedOutline} slot="start" />
                <IonLabel>
                  <h3>Password</h3>
                  <p>{memberSince ? `Member since ${memberSince}` : "Account password"}</p>
                </IonLabel>
              </IonItem>
            </IonList>
          )}
        </div>

        <div className="settings-section">
          <h2>App Settings</h2>
          <IonList className="settings-list" lines="full">
            <IonItem className="settings-item" detail>
              <IonIcon icon={notificationsOutline} slot="start" />
              <IonLabel>
                <h3>Notifications</h3>
              </IonLabel>
            </IonItem>
            <IonItem className="settings-item" detail>
              <IonIcon icon={locationOutline} slot="start" />
              <IonLabel>
                <h3>Location Permissions</h3>
              </IonLabel>
            </IonItem>
          </IonList>
        </div>

        <div className="settings-section">
          <IonList className="settings-list" lines="none">
            <IonItem button className="settings-item settings-logout-item" onClick={handleLogout}>
              <IonIcon icon={logOutOutline} slot="start" color="danger" />
              <IonLabel color="danger">
                <h3>Sign Out</h3>
              </IonLabel>
            </IonItem>
          </IonList>
        </div>

        <div className="settings-footer">
          <small>CoRide v1.0.0</small>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
