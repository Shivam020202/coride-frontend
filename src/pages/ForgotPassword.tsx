import React, { useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonItem,
  IonIcon,
  useIonToast,
} from "@ionic/react";
import { arrowBack } from "ionicons/icons";
import axios from "axios";
import "./Auth.css";

type Step = "email" | "otp" | "reset";

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const [present] = useIonToast();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    // Safety timeout — never stay loading for more than 25s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      present({ message: "Request timed out. Please try again.", duration: 3000, color: "danger" });
    }, 25000);

    try {
      await axios.post(`${apiUrl}/auth/forgot-password`, { email }, { timeout: 20000 });
      clearTimeout(safetyTimer);
      present({ message: "OTP sent to your email!", duration: 2500, color: "success" });
      setStep("otp");
    } catch (error: any) {
      clearTimeout(safetyTimer);
      const msg = error.code === "ECONNABORTED"
        ? "Request timed out. Please try again."
        : error.response?.data?.msg || "Failed to send OTP.";
      present({ message: msg, duration: 3000, color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const updated = [...otp];
    updated[index] = value;
    setOtp(updated);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      present({ message: "Please enter the full 6-digit code.", duration: 2500, color: "warning" });
      return;
    }
    setLoading(true);

    try {
      await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp: otpString });
      present({ message: "OTP verified!", duration: 2000, color: "success" });
      setStep("reset");
    } catch (error: any) {
      present({
        message: error.response?.data?.msg || "Invalid or expired OTP.",
        duration: 3000,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      present({ message: "Password must be at least 6 characters.", duration: 2500, color: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      present({ message: "Passwords do not match.", duration: 2500, color: "warning" });
      return;
    }
    setLoading(true);

    try {
      const otpString = otp.join("");
      await axios.post(`${apiUrl}/auth/reset-password`, {
        email,
        otp: otpString,
        newPassword,
      });
      present({ message: "Password reset successfully!", duration: 2500, color: "success" });
      history.replace("/login");
    } catch (error: any) {
      present({
        message: error.response?.data?.msg || "Failed to reset password.",
        duration: 3000,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const stepTitle: Record<Step, string> = {
    email: "Forgot password?",
    otp: "Enter verification code",
    reset: "Create new password",
  };

  const stepSubtitle: Record<Step, string> = {
    email: "Enter your email and we'll send you a code to reset your password.",
    otp: `We sent a 6-digit code to ${email}`,
    reset: "Your new password must be at least 6 characters.",
  };

  return (
    <IonPage>
      <IonContent className="auth-content" scrollY={false}>
        <div className="auth-container">
          <div className="fp-back-row">
            <IonButton
              fill="clear"
              className="fp-back-btn"
              onClick={() => {
                if (step === "email") history.goBack();
                else if (step === "otp") setStep("email");
                else setStep("otp");
              }}
            >
              <IonIcon icon={arrowBack} slot="icon-only" />
            </IonButton>
          </div>

          <div className="auth-header">
            <h1 className="brand-logo">{stepTitle[step]}</h1>
            <p>{stepSubtitle[step]}</p>
          </div>

          {/* Step 1: Email */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} className="auth-form">
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
              <IonButton expand="block" type="submit" className="auth-button" disabled={loading}>
                Send Code
              </IonButton>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="auth-form">
              <div className="otp-input-row" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="otp-box"
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              <IonButton expand="block" type="submit" className="auth-button" disabled={loading}>
                Verify Code
              </IonButton>
              <div className="fp-resend-row">
                <IonText color="medium">Didn't receive it?</IonText>
                <IonButton
                  fill="clear"
                  className="link-button"
                  size="small"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await axios.post(`${apiUrl}/auth/forgot-password`, { email });
                      present({ message: "New OTP sent!", duration: 2000, color: "success" });
                      setOtp(["", "", "", "", "", ""]);
                    } catch {
                      present({ message: "Failed to resend.", duration: 2500, color: "danger" });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Resend
                </IonButton>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="auth-form">
              <IonItem className="auth-input-item" lines="none">
                <IonInput
                  label="New Password"
                  labelPlacement="floating"
                  type="password"
                  value={newPassword}
                  onIonChange={(e) => setNewPassword(e.detail.value!)}
                  required
                />
              </IonItem>
              <IonItem className="auth-input-item" lines="none">
                <IonInput
                  label="Confirm Password"
                  labelPlacement="floating"
                  type="password"
                  value={confirmPassword}
                  onIonChange={(e) => setConfirmPassword(e.detail.value!)}
                  required
                />
              </IonItem>
              <IonButton expand="block" type="submit" className="auth-button" disabled={loading}>
                Reset Password
              </IonButton>
            </form>
          )}

          <div className="auth-footer">
            <IonText>Remember your password?</IonText>
            <IonButton fill="clear" onClick={() => history.push("/login")} className="link-button">
              Sign in
            </IonButton>
          </div>
        </div>
        {loading && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, backdropFilter: "blur(4px)",
          }}>
            <div style={{ textAlign: "center" }}>
              <div className="otp-loading-spinner" style={{
                width: 36, height: 36, border: "3px solid #e4e4e7",
                borderTopColor: "#18181b", borderRadius: "50%",
                animation: "spin 0.7s linear infinite", margin: "0 auto 12px",
              }} />
              <p style={{ color: "#71717a", fontSize: "0.875rem", fontWeight: 500 }}>Please wait...</p>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ForgotPassword;
