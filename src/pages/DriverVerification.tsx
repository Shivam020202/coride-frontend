import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonLoading,
  IonSpinner,
  useIonToast,
} from "@ionic/react";
import {
  arrowBack,
  chevronForward,
  documentTextOutline,
  checkmarkCircle,
  closeCircle,
  cloudUploadOutline,
  trashOutline,
  timeOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import axios from "axios";
import "./DriverVerification.css";

interface DocItem {
  name: string;
  required: boolean;
  status: "pending" | "submitted" | "approved" | "rejected";
  fileUrl?: string;
  submittedAt?: string;
  note?: string;
}

interface Verification {
  _id: string;
  status: "incomplete" | "pending_review" | "approved" | "rejected";
  documents: DocItem[];
  reviewNote?: string;
}

const statusLabels: Record<string, string> = {
  pending: "Not submitted",
  submitted: "Submitted",
  approved: "Completed",
  rejected: "Rejected — resubmit",
};

const bannerConfig: Record<string, { icon: string; title: string; desc: string }> = {
  incomplete: {
    icon: timeOutline,
    title: "Verification Incomplete",
    desc: "Complete all required documents to start accepting rides.",
  },
  pending_review: {
    icon: timeOutline,
    title: "Under Review",
    desc: "Your documents are being reviewed. This usually takes 1-2 business days.",
  },
  approved: {
    icon: shieldCheckmarkOutline,
    title: "Verified Driver",
    desc: "Your account is verified. You can now accept ride requests.",
  },
  rejected: {
    icon: closeCircle,
    title: "Verification Rejected",
    desc: "Some documents need attention. Please review and resubmit.",
  },
};

const DriverVerification: React.FC = () => {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const history = useHistory();
  const [present] = useIonToast();

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const token = localStorage.getItem("token");
  const headers = { "x-auth-token": token };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${apiUrl}/verification/status`, { headers });
      setVerification(res.data);
    } catch (err) {
      console.error("Error fetching verification status", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDocTap = (doc: DocItem) => {
    if (verification?.status === "pending_review" || verification?.status === "approved") return;
    if (doc.status === "approved") return;

    // Terms and Conditions is accept-only
    if (doc.name === "Terms and Conditions") {
      handleAcceptDoc(doc.name);
      return;
    }

    setActiveDoc(doc);
    setSelectedFile(null);
  };

  const handleAcceptDoc = async (docName: string) => {
    try {
      await axios.post(
        `${apiUrl}/verification/accept/${encodeURIComponent(docName)}`,
        {},
        { headers }
      );
      present({ message: "Accepted!", duration: 1500, color: "success" });
      fetchStatus();
    } catch {
      present({ message: "Failed to accept", duration: 2000, color: "danger" });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!activeDoc || !selectedFile) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await axios.post(
        `${apiUrl}/verification/upload/${encodeURIComponent(activeDoc.name)}`,
        formData,
        {
          headers: { ...headers, "Content-Type": "multipart/form-data" },
        }
      );

      present({ message: "Document uploaded!", duration: 2000, color: "success" });
      setActiveDoc(null);
      setSelectedFile(null);
      fetchStatus();
    } catch {
      present({ message: "Upload failed. Try again.", duration: 2500, color: "danger" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitAll = async () => {
    try {
      setUploading(true);
      await axios.post(`${apiUrl}/verification/submit`, {}, { headers });
      present({
        message: "Documents submitted for review!",
        duration: 3000,
        color: "success",
      });
      fetchStatus();
    } catch (err: any) {
      const missing = err.response?.data?.missing;
      if (missing) {
        present({
          message: `Missing: ${missing.join(", ")}`,
          duration: 4000,
          color: "warning",
        });
      } else {
        present({ message: "Submission failed", duration: 2500, color: "danger" });
      }
    } finally {
      setUploading(false);
    }
  };

  const getDocIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return cloudUploadOutline;
      case "approved":
        return checkmarkCircle;
      case "rejected":
        return closeCircle;
      default:
        return documentTextOutline;
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="verification-content">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!verification) return null;

  const docs = verification.documents;
  const submitted = docs.filter((d) => d.status !== "pending").length;
  const total = docs.length;
  const progress = total > 0 ? (submitted / total) * 100 : 0;
  const requiredDone = docs.filter((d) => d.required).every((d) => d.status !== "pending");
  const banner = bannerConfig[verification.status];

  return (
    <IonPage>
      <IonContent className="verification-content" scrollY>
        <div className="verification-container">
          {/* Header */}
          <div className="verification-header">
            <div className="verification-back-row">
              <IonButton
                fill="clear"
                className="verification-back-btn"
                onClick={() => history.goBack()}
              >
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
            </div>
            <h1>Driver Verification</h1>
            <p>Complete the required documents below to get verified and start accepting rides.</p>
          </div>

          {/* Status Banner */}
          <div className={`verification-status-banner ${verification.status}`}>
            <IonIcon icon={banner.icon} className="status-banner-icon" />
            <div className="status-banner-text">
              <h3>{banner.title}</h3>
              <p>{verification.status === "rejected" && verification.reviewNote
                ? verification.reviewNote
                : banner.desc}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="verification-progress">
            <div className="progress-label">
              <span>Progress</span>
              <span>{submitted} of {total} completed</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Required Documents */}
          <div className="doc-section-title">Required Documents</div>
          <div className="doc-list">
            {docs.filter((d) => d.required).map((doc) => (
              <div key={doc.name} className="doc-item" onClick={() => handleDocTap(doc)}>
                <div className="doc-item-left">
                  <div className={`doc-icon-wrap ${doc.status}`}>
                    <IonIcon icon={getDocIcon(doc.status)} />
                  </div>
                  <div className="doc-info">
                    <h4>{doc.name}</h4>
                    <p className={`doc-subtitle ${doc.status}`}>
                      {statusLabels[doc.status]}
                    </p>
                  </div>
                </div>
                <div className="doc-item-right">
                  <IonIcon icon={chevronForward} className="doc-chevron" />
                </div>
              </div>
            ))}
          </div>

          {/* Optional Documents */}
          {docs.some((d) => !d.required) && (
            <>
              <div className="doc-section-title">Optional</div>
              <div className="doc-list">
                {docs.filter((d) => !d.required).map((doc) => (
                  <div key={doc.name} className="doc-item" onClick={() => handleDocTap(doc)}>
                    <div className="doc-item-left">
                      <div className={`doc-icon-wrap ${doc.status}`}>
                        <IonIcon icon={getDocIcon(doc.status)} />
                      </div>
                      <div className="doc-info">
                        <h4>{doc.name}</h4>
                        <p className={`doc-subtitle ${doc.status}`}>
                          {statusLabels[doc.status]}
                        </p>
                      </div>
                    </div>
                    <div className="doc-item-right">
                      <span className="optional-badge">Optional</span>
                      <IonIcon icon={chevronForward} className="doc-chevron" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Submit All */}
          {verification.status === "incomplete" && (
            <div className="submit-all-section">
              <IonButton
                expand="block"
                className="submit-all-btn"
                disabled={!requiredDone || uploading}
                onClick={handleSubmitAll}
              >
                Submit for Verification
              </IonButton>
            </div>
          )}

          {/* Skip for now */}
          {verification.status === "incomplete" && (
            <div className="skip-link">
              <IonButton
                fill="clear"
                onClick={() => history.push("/driver/home")}
              >
                Skip for now
              </IonButton>
            </div>
          )}
        </div>

        {/* Upload Bottom Sheet */}
        {activeDoc && (
          <div className="upload-overlay" onClick={() => setActiveDoc(null)}>
            <div className="upload-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="upload-sheet-handle" />
              <h3>{activeDoc.name}</h3>
              <p>Upload a clear photo or PDF of this document.</p>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              {!selectedFile ? (
                <div
                  className="upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-dropzone-icon">
                    <IonIcon icon={cloudUploadOutline} />
                  </div>
                  <h4>Tap to select file</h4>
                  <p>JPG, PNG or PDF up to 10MB</p>
                </div>
              ) : (
                <div className="upload-preview">
                  <IonIcon icon={documentTextOutline} className="upload-preview-icon" />
                  <div className="upload-preview-info">
                    <p>{selectedFile.name}</p>
                    <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button
                    className="upload-preview-remove"
                    onClick={() => setSelectedFile(null)}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>
              )}

              <div className="upload-sheet-actions">
                <IonButton
                  expand="block"
                  className="upload-btn-secondary"
                  onClick={() => setActiveDoc(null)}
                >
                  Cancel
                </IonButton>
                <IonButton
                  expand="block"
                  className="upload-btn-primary"
                  disabled={!selectedFile || uploading}
                  onClick={handleUpload}
                >
                  {uploading ? <IonSpinner name="crescent" /> : "Upload"}
                </IonButton>
              </div>
            </div>
          </div>
        )}

        <IonLoading isOpen={uploading} message="Uploading..." spinner="crescent" mode="ios" />
      </IonContent>
    </IonPage>
  );
};

export default DriverVerification;
