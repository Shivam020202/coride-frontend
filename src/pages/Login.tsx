import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonItem,
  IonLoading,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  useIonToast,
} from "@ionic/react";
import axios from "axios";
import { Geolocation } from "@capacitor/geolocation";
import "./Auth.css";

/** Silently request geolocation permission — must be called within a user gesture */
const requestLocationPermission = async () => {
  try {
    // Try Capacitor first (works on native + PWA)
    await Geolocation.requestPermissions();
  } catch {
    // Fallback: trigger the browser's native permission dialog
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {}, // success — permission granted
        () => {}, // deny — user said no, we'll handle later
        { timeout: 5000 }
      );
    }
  }
};

const Login: React.FC = () => {
  const [role, setRole] = useState<"consumer" | "driver">("consumer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const [present] = useIonToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
        role,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("role", response.data.role);

      // Request location permission right after login (user gesture context active)
      // Do not await — runs in background so navigation isn't blocked
      requestLocationPermission();

      setLoading(false);
      present({
        message: "Logged in successfully!",
        duration: 2000,
        color: "success",
      });
      history.push(role === "consumer" ? "/tabs/home" : "/driver/home");
    } catch (error: any) {
      setLoading(false);
      present({
        message: error.response?.data?.msg || "An error occurred during login.",
        duration: 3000,
        color: "danger",
      });
    }
  };


  return (
    <IonPage>
      <IonContent className="auth-content" scrollY={false}>
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="brand-logo">CoRide.</h1>
            <p>Welcome back, sign in to continue.</p>
          </div>

          <IonSegment
            value={role}
            onIonChange={(e) =>
              setRole(e.detail.value as "consumer" | "driver")
            }
            className="role-segment"
          >
            <IonSegmentButton value="consumer">
              <IonLabel>Rider</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="driver">
              <IonLabel>Driver</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <form onSubmit={handleLogin} className="auth-form">
            <IonItem className="auth-input-item" lines="none">
              <IonInput
                label="Email"
                labelPlacement="floating"
                type="email"
                value={email}
                onIonChange={(e) => setEmail(e.detail.value!)}
                required
              />
            </IonItem>

            <IonItem className="auth-input-item" lines="none">
              <IonInput
                label="Password"
                labelPlacement="floating"
                type="password"
                value={password}
                onIonChange={(e) => setPassword(e.detail.value!)}
                required
              />
            </IonItem>

            <div className="forgot-password-row">
              <IonButton fill="clear" className="forgot-btn" size="small">
                Forgot password?
              </IonButton>
            </div>

            <IonButton
              expand="block"
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              Sign in
            </IonButton>
          </form>

          <div className="auth-footer">
            <IonText>Don't have an account?</IonText>
            <IonButton
              fill="clear"
              onClick={() => history.push(`/signup`)}
              className="link-button"
            >
              Sign up
            </IonButton>
          </div>
        </div>
        <IonLoading
          isOpen={loading}
          message={"Authenticating..."}
          spinner="crescent"
          mode="ios"
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
