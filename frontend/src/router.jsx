import { createBrowserRouter, Outlet } from "react-router-dom";

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
import Booking from "./app/pages/Booking.jsx";
import Calendar from "./app/pages/Calendar.jsx";
import TravelSuggestion from "./app/pages/TravelSuggestion.jsx"; 
import Todo from "./app/pages/Todo.jsx";

import Finance from "./app/pages/Finance.jsx";
import GroupVote from "./app/pages/GroupVote.jsx";
import WelcomeAfterLogin from "./app/pages/WelcomeAfterLogin.jsx";
import ChatWidget from "./components/ChatWidget.jsx";
import Emergency from "./app/pages/Emergency.jsx";
import Gallery from "./app/pages/Gallery.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";


// Layout that injects the floating AI chat widget and network status on authenticated pages
function AuthLayout() {
  return (
    <>
      <OfflineBanner />
      <Outlet />
      <ChatWidget />
    </>
  );
}

const router = createBrowserRouter([
    // Public routes (no chat widget)
    { path: "/", element: <Landing /> },
    { path: "/about", element: <About /> },
    { path: "/contactus", element: <ContactUs /> },
    { path: "/service", element: <Service /> },
    { path: "/feedback", element: <Feedback /> },
    { path: "/login", element: <Login /> },
    { path: "/signup", element: <SignUp /> },
    { path: "/resetpassword", element: <ResetPassword /> },
    { path: "/otp", element: <OTP /> },
    { path: "/newpassword", element: <NewPassword /> },

    // Authenticated routes (chat widget available)
    {
      element: <AuthLayout />,
      children: [
        { path: "/dashboard", element: <Dashboard /> },
        { path: "/settings", element: <Settings /> },
        { path: "/profile", element: <Profile /> },
        { path: "/navigation", element: <Navigation /> },
        { path: "/expenses", element: <Expenses /> },
        { path: "/message", element: <Message /> },
        { path: "/booking", element: <Booking /> },
        { path: "/calendar", element: <Calendar /> },
        { path: "/finance", element: <Finance /> },
        { path: "/vote",    element: <GroupVote /> },
        { path: "/welcome", element: <WelcomeAfterLogin /> },
        { path: "/suggestions", element: <TravelSuggestion /> },
        { path: "/todo", element: <Todo /> },
        { path: "/emergency", element: <Emergency /> },
        { path: "/gallery", element: <Gallery /> }
      ],
    },
]);

export default router;
