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
  IonAvatar,
  IonSpinner,
} from "@ionic/react";
import axios from "axios";
import {
  star,
  giftOutline,
  mailOutline,
  documentTextOutline,
  logOutOutline,
  personCircleOutline,
  shieldCheckmarkOutline,
  settingsOutline,
  helpCircleOutline,
} from "ionicons/icons";
import "./Profile.css";

const Profile: React.FC = () => {
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

  const handleLogout = () => {
    history.push("/login");
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="premium-header-bg">
          <IonTitle className="premium-title">Account</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="profile-bg">
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "20px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <div className="profile-header-premium">
            <div className="profile-user-info">
              <h2>{user?.name || "User"}</h2>
              <div className="profile-rating-badge">
                <IonIcon icon={star} className="star-icon" /> <span>4.95</span>{" "}
                Rating
              </div>
            </div>
            <IonAvatar className="profile-large-avatar">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "U")}&background=random`}
                alt="Profile"
              />
            </IonAvatar>
          </div>
        )}

        <div className="profile-card">
          <IonList className="profile-list" lines="none">
            <IonItem button detail className="profile-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={personCircleOutline} />
              </div>
              <IonLabel>Personal Information</IonLabel>
            </IonItem>

            <IonItem button detail className="profile-item">
              <div
                slot="start"
                className="item-icon-wrapper bg-blue-light text-brand"
              >
                <IonIcon icon={shieldCheckmarkOutline} />
              </div>
              <IonLabel>Safety & Trust</IonLabel>
            </IonItem>

            <IonItem button detail className="profile-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={giftOutline} />
              </div>
              <IonLabel>Promotions</IonLabel>
            </IonItem>

            <IonItem button detail className="profile-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={mailOutline} />
              </div>
              <IonLabel>Messages</IonLabel>
            </IonItem>

            <IonItem
              button
              detail
              className="profile-item"
              onClick={() => history.push("/settings")}
            >
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={settingsOutline} />
              </div>
              <IonLabel>Settings</IonLabel>
            </IonItem>

            <IonItem button detail className="profile-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={helpCircleOutline} />
              </div>
              <IonLabel>Help</IonLabel>
            </IonItem>

            <IonItem button detail className="profile-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={documentTextOutline} />
              </div>
              <IonLabel>Legal</IonLabel>
            </IonItem>

            <IonItem
              button
              detail={false}
              className="profile-item logout-item"
              onClick={handleLogout}
            >
              <div
                slot="start"
                className="item-icon-wrapper bg-light-red text-red"
              >
                <IonIcon icon={logOutOutline} />
              </div>
              <IonLabel className="text-red">Sign Out</IonLabel>
            </IonItem>
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Profile;
