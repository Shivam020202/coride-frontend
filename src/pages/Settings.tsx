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
  homeOutline,
  briefcaseOutline,
  personOutline,
  mailOutline,
  callOutline,
  lockClosedOutline,
  notificationsOutline,
  locationOutline,
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
        const apiUrl =
          import.meta.env.VITE_API_URL || "http://localhost:5000/api";
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
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "20px",
              }}
            >
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <IonList className="settings-list" lines="full">
              <IonItem className="settings-item" detail>
                <IonIcon icon={personOutline} slot="start" />
                <IonLabel>
                  <h3>{user?.name || "Name not set"}</h3>
                  <p>Name</p>
                </IonLabel>
              </IonItem>
              <IonItem className="settings-item" detail>
                <IonIcon icon={callOutline} slot="start" />
                <IonLabel>
                  <h3>+1 (555) 123-4567</h3>
                  <p>Phone Number</p>
                </IonLabel>
              </IonItem>
              <IonItem className="settings-item" detail>
                <IonIcon icon={mailOutline} slot="start" />
                <IonLabel>
                  <h3>{user?.email || "Email not set"}</h3>
                  <p>Email</p>
                </IonLabel>
              </IonItem>
              <IonItem className="settings-item" detail>
                <IonIcon icon={lockClosedOutline} slot="start" />
                <IonLabel>
                  <h3>Password</h3>
                  <p>Updated when signed up</p>
                </IonLabel>
              </IonItem>
            </IonList>
          )}
        </div>

        <div className="settings-section">
          <h2>Saved Places</h2>
          <IonList className="settings-list" lines="none">
            <IonItem className="settings-saved-item" detail>
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={homeOutline} />
              </div>
              <IonLabel>
                <h3>Home</h3>
                <p>123 Main Street, Apt 4B</p>
              </IonLabel>
            </IonItem>
            <IonItem className="settings-saved-item" detail>
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={briefcaseOutline} />
              </div>
              <IonLabel>
                <h3>Work</h3>
                <p>456 Tech Park, Building A</p>
              </IonLabel>
            </IonItem>
            <IonItem className="settings-add-item">
              <IonLabel color="brand" className="text-brand font-semibold">
                Add Saved Place
              </IonLabel>
            </IonItem>
          </IonList>
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

        <div className="settings-footer">
          <p>Sign Out</p>
          <small>Version 1.0.4 (Production)</small>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
