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
  IonButton,
  IonSpinner,
} from "@ionic/react";
import axios from "axios";
import {
  cashOutline,
  cardOutline,
  logoApple,
  addOutline,
  chevronForward,
  pricetagOutline,
} from "ionicons/icons";
import "./Wallet.css";

const Wallet: React.FC = () => {
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

  const generateBalance = () => {
    if (!user) return "0.00";
    // simple hash trick
    let hash = 0;
    for (let i = 0; i < user.email.length; i++) {
      hash = user.email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs((hash % 10000) / 100).toFixed(2);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="premium-header-bg">
          <IonTitle className="premium-title">Wallet</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="wallet-bg">
        <div className="wallet-balance-card">
          <div className="balance-info">
            <p className="wallet-subtitle">CoRide Cash</p>
            {loading ? (
              <IonSpinner name="dots" color="light" />
            ) : (
              <h1 className="wallet-amount">${generateBalance()}</h1>
            )}
            <p className="auto-refill-text">Auto-refill is enabled</p>
          </div>
          <IonButton className="add-funds-btn" fill="clear">
            <IonIcon slot="start" icon={addOutline} />
            Add Funds
          </IonButton>
        </div>

        <div className="payment-methods-section">
          <h3 className="section-title">Payment Methods</h3>
          <IonList className="wallet-list" lines="none">
            <IonItem className="wallet-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={logoApple} />
              </div>
              <IonLabel>
                <h2>Apple Pay</h2>
              </IonLabel>
              <IonIcon slot="end" icon={chevronForward} color="medium" />
            </IonItem>

            <IonItem className="wallet-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={cardOutline} />
              </div>
              <IonLabel>
                <h2>Personal •••• 4545</h2>
                <p>Expires 12/26</p>
              </IonLabel>
              <IonIcon slot="end" icon={chevronForward} color="medium" />
            </IonItem>

            <IonItem className="wallet-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={cashOutline} />
              </div>
              <IonLabel>
                <h2>Cash</h2>
              </IonLabel>
              <IonIcon slot="end" icon={chevronForward} color="medium" />
            </IonItem>

            <IonItem
              button
              detail={false}
              className="wallet-item add-payment-item"
            >
              <div slot="start" className="item-icon-wrapper bg-transparent">
                <IonIcon icon={addOutline} color="dark" />
              </div>
              <IonLabel color="dark" className="add-payment-label">
                Add Payment Method
              </IonLabel>
            </IonItem>
          </IonList>
        </div>

        <div className="promotions-section">
          <h3 className="section-title">Vouchers & Promos</h3>
          <IonList className="wallet-list" lines="none">
            <IonItem className="wallet-item">
              <div slot="start" className="item-icon-wrapper bg-gray">
                <IonIcon icon={pricetagOutline} />
              </div>
              <IonLabel>
                <h2>Add promo code</h2>
              </IonLabel>
            </IonItem>
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Wallet;
