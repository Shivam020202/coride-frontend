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
import "./Auth.css";

const Signup: React.FC = () => {
  const [role, setRole] = useState<"consumer" | "driver">("consumer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const [present] = useIonToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const response = await axios.post(`${apiUrl}/auth/register`, {
        name,
        email,
        password,
        role,
        gender,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("role", response.data.role);

      setLoading(false);
      present({
        message: "Account created successfully!",
        duration: 2000,
        color: "success",
      });
      history.push(role === "consumer" ? "/tabs/home" : "/driver/home");
    } catch (error: any) {
      setLoading(false);
      present({
        message:
          error.response?.data?.msg || "An error occurred during signup.",
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
            <p>Create your account to get started.</p>
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

          <form onSubmit={handleSignup} className="auth-form">
            <IonItem className="auth-input-item" lines="none">
              <IonInput
                label="Full name"
                labelPlacement="floating"
                type="text"
                value={name}
                onIonChange={(e) => setName(e.detail.value!)}
                required
              />
            </IonItem>

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

            {/* Gender selector */}
            <div className="gender-select-wrapper">
              <label className="gender-label">Gender</label>
              <select
                className="gender-select"
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female" | "other")}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
            </div>

            <IonButton
              expand="block"
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              Create account
            </IonButton>
          </form>

          <div className="auth-footer">
            <IonText>Already have an account?</IonText>
            <IonButton
              fill="clear"
              onClick={() => history.push("/login")}
              className="link-button"
            >
              Sign in
            </IonButton>
          </div>
        </div>
        <IonLoading
          isOpen={loading}
          message={"Creating Account..."}
          spinner="crescent"
          mode="ios"
        />
      </IonContent>
    </IonPage>
  );
};

export default Signup;

