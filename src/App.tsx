import React, { useEffect, useState } from "react";
import { Redirect, Route } from "react-router-dom";
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonSpinner,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import {
  mapOutline,
  timeOutline,
  personOutline,
  cardOutline,
} from "ionicons/icons";
import axios from "axios";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import RideHistory from "./pages/RideHistory";
import ActiveRide from "./pages/ActiveRide";
import Wallet from "./pages/Wallet";
import Settings from "./pages/Settings";

// Driver pages
import DriverHome from "./pages/DriverHome";
import DriverHistory from "./pages/DriverHistory";
import DriverProfile from "./pages/DriverProfile";
import DriverActiveRide from "./pages/DriverActiveRide";
import TrackRide from "./pages/TrackRide";
import DriverVerification from "./pages/DriverVerification";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
import "./index.css";

setupIonicReact({ mode: 'ios' });

const MainTabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route exact path="/tabs/home" component={Home} />
      <Route exact path="/tabs/history" component={RideHistory} />
      <Route exact path="/tabs/wallet" component={Wallet} />
      <Route exact path="/tabs/profile" component={Profile} />
      <Route exact path="/tabs">
        <Redirect to="/tabs/home" />
      </Route>
    </IonRouterOutlet>
    <IonTabBar slot="bottom" className="premium-tab-bar">
      <IonTabButton tab="home" href="/tabs/home">
        <IonIcon icon={mapOutline} />
        <IonLabel>Ride</IonLabel>
      </IonTabButton>
      <IonTabButton tab="history" href="/tabs/history">
        <IonIcon icon={timeOutline} />
        <IonLabel>Activity</IonLabel>
      </IonTabButton>
      <IonTabButton tab="wallet" href="/tabs/wallet">
        <IonIcon icon={cardOutline} />
        <IonLabel>Wallet</IonLabel>
      </IonTabButton>
      <IonTabButton tab="profile" href="/tabs/profile">
        <IonIcon icon={personOutline} />
        <IonLabel>Account</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

const DriverTabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route exact path="/driver/home" component={DriverHome} />
      <Route exact path="/driver/active-ride" component={DriverActiveRide} />
      <Route exact path="/driver/history" component={DriverHistory} />
      <Route exact path="/driver/profile" component={DriverProfile} />
      <Route exact path="/driver">
        <Redirect to="/driver/home" />
      </Route>
    </IonRouterOutlet>
    <IonTabBar slot="bottom" className="premium-tab-bar">
      <IonTabButton tab="home" href="/driver/home">
        <IonIcon icon={mapOutline} />
        <IonLabel>Dashboard</IonLabel>
      </IonTabButton>
      <IonTabButton tab="history" href="/driver/history">
        <IonIcon icon={timeOutline} />
        <IonLabel>Earnings</IonLabel>
      </IonTabButton>
      <IonTabButton tab="profile" href="/driver/profile">
        <IonIcon icon={personOutline} />
        <IonLabel>Account</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

const AuthGuard: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");

      if (!token || !role) {
        setRedirectTo("/login");
        setChecking(false);
        return;
      }

      try {
        const apiUrl =
          import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        await axios.get(`${apiUrl}/auth/me`, {
          headers: { "x-auth-token": token },
        });
        // Token is valid — redirect based on role
        setRedirectTo(role === "driver" ? "/driver/home" : "/tabs/home");
      } catch {
        // Token expired or invalid — clear and send to login
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setRedirectTo("/login");
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, []);

  if (checking) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <IonSpinner name="crescent" />
      </div>
    );
  }

  return <Redirect to={redirectTo!} />;
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/login" component={Login} />
        <Route exact path="/signup" component={Signup} />
        <Route exact path="/forgot-password" component={ForgotPassword} />
        <Route exact path="/active-ride" component={ActiveRide} />
        <Route exact path="/driver/active-ride" component={DriverActiveRide} />
        <Route exact path="/settings" component={Settings} />
        <Route exact path="/track" component={TrackRide} />
        <Route exact path="/verification" component={DriverVerification} />
        <Route path="/tabs" component={MainTabs} />
        <Route path="/driver" component={DriverTabs} />
        <Route exact path="/" component={AuthGuard} />
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
