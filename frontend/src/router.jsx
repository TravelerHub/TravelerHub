import { createBrowserRouter } from "react-router-dom";

import Landing from "./app/pages/Landing.jsx";
import About from "./app/pages/About.jsx";
import ContactUs from "./app/pages/ContactUs.jsx";
import Service from "./app/pages/Service.jsx";
import Feedback from "./app/pages/Feedback.jsx";
import Login from "./app/pages/Login.jsx";
import SignUp from "./app/pages/SignUp.jsx";
import Dashboard from "./app/pages/Dashboard.jsx";
import Settings from "./app/pages/Settings.jsx";
import Profile  from "./app/pages/Profile.jsx"; 
import Navigation from "./app/pages/Navigation.jsx";

const router = createBrowserRouter([
    { path: "/", element: <Landing /> },
    { path: "/about", element: <About /> },
    { path: "/contactus", element: <ContactUs /> },
    { path: "/service", element: <Service /> },
    { path: "/feedback", element: <Feedback /> },
    { path: "/login", element: <Login /> },
    { path: "/signup", element: <SignUp /> },
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/settings", element: <Settings /> },
    { path: "/profile", element: <Profile />}, 
    { path: "/navigation", element: <Navigation /> }
]);

export default router;