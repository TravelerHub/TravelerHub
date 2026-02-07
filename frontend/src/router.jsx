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
import ResetPassword from "./app/pages/ResetPassword.jsx"; 
import OTP from "./app/pages/OTP.jsx";
import NewPassword from "./app/pages/NewPassword.jsx";
import Expenses from "./app/pages/Expenses.jsx";
import Message from "./app/pages/Message.jsx";

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
    { path: "/navigation", element: <Navigation /> },
    { path: "/resetpassword", element: <ResetPassword /> },
    { path: "/otp", element: <OTP /> },
    { path: "/newpassword", element: <NewPassword /> }, 
    { path: "/expenses", element: <Expenses /> },
    { path: "/message", element: <Message /> },
]);

export default router;