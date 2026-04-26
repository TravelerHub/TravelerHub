import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

// Eager: public LCP-critical pages and shared layout pieces.
import Landing from "./app/pages/Landing.jsx";
import Login from "./app/pages/Login.jsx";
import SignUp from "./app/pages/SignUp.jsx";
import NotFound from "./app/pages/NotFound";
import OTP from "./app/pages/OTP.jsx";

import ChatWidget from "./components/ChatWidget.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import MobileNav from "./components/MobileNav.jsx";
import RouteFallback from "./components/RouteFallback.jsx";

// Lazy: every other page splits into its own chunk.
const About = lazy(() => import("./app/pages/About.jsx"));
const ContactUs = lazy(() => import("./app/pages/ContactUs.jsx"));
const Service = lazy(() => import("./app/pages/Service.jsx"));
const Feedback = lazy(() => import("./app/pages/Feedback.jsx"));
const Dashboard = lazy(() => import("./app/pages/Dashboard.jsx"));
const Settings = lazy(() => import("./app/pages/Settings.jsx"));
const Profile = lazy(() => import("./app/pages/Profile.jsx"));
const Navigation = lazy(() => import("./app/pages/Navigation.jsx"));
const ResetPassword = lazy(() => import("./app/pages/ResetPassword.jsx"));
const NewPassword = lazy(() => import("./app/pages/NewPassword.jsx"));
const Expenses = lazy(() => import("./app/pages/Expenses.jsx"));
const Message = lazy(() => import("./app/pages/Message.jsx"));
const Booking = lazy(() => import("./app/pages/Booking.jsx"));
const Calendar = lazy(() => import("./app/pages/Calendar.jsx"));
const TravelSuggestion = lazy(() => import("./app/pages/TravelSuggestion.jsx"));
const Todo = lazy(() => import("./app/pages/Todo.jsx"));
const Finance = lazy(() => import("./app/pages/Finance.jsx"));
const GroupVote = lazy(() => import("./app/pages/GroupVote.jsx"));
const WelcomeAfterLogin = lazy(() => import("./app/pages/WelcomeAfterLogin.jsx"));
const Emergency = lazy(() => import("./app/pages/Emergency.jsx"));
const Gallery = lazy(() => import("./app/pages/Gallery.jsx"));
const StoryMode = lazy(() => import("./components/StoryMode.jsx"));
const PublicStory = lazy(() => import("./app/pages/PublicStory.jsx"));
const JoinTrip = lazy(() => import("./app/pages/JoinTrip.jsx"));
const Notifications = lazy(() => import("./app/pages/Notifications"));


// Layout that injects the floating AI chat widget and network status on authenticated pages.
// The Suspense boundary lives here so any lazy authenticated page can show RouteFallback.
function AuthLayout() {
  return (
    <>
      <OfflineBanner />
      {/* pb-16 gives content room above the mobile bottom nav; cancelled on md+ */}
      <div className="pb-16 md:pb-0">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <ChatWidget />
      <InstallPrompt />
      <MobileNav />
    </>
  );
}

// Wrap a single lazy element in Suspense (used for public lazy routes that
// don't share a parent layout with its own Suspense boundary).
function LazyRoute({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

const router = createBrowserRouter([
    // Top-level ErrorBoundary wraps all routes
    {
      element: (
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      ),
      children: [
        // Public routes (no chat widget)
        { path: "/", element: <Landing /> },
        { path: "/about", element: <LazyRoute><About /></LazyRoute> },
        { path: "/contactus", element: <LazyRoute><ContactUs /></LazyRoute> },
        { path: "/service", element: <LazyRoute><Service /></LazyRoute> },
        { path: "/feedback", element: <LazyRoute><Feedback /></LazyRoute> },
        { path: "/login", element: <Login /> },
        { path: "/signup", element: <SignUp /> },
        { path: "/resetpassword", element: <LazyRoute><ResetPassword /></LazyRoute> },
        { path: "/otp", element: <OTP /> },
        { path: "/newpassword", element: <LazyRoute><NewPassword /></LazyRoute> },
        { path: "/join/:token", element: <LazyRoute><JoinTrip /></LazyRoute> },
        { path: "/story/public/:token", element: <LazyRoute><PublicStory /></LazyRoute> },

        // Authenticated routes (chat widget available)
        {
          element: <AuthLayout />,
          children: [
            {
              path: "/dashboard",
              element: (
                <ErrorBoundary>
                  <Dashboard />
                </ErrorBoundary>
              ),
            },
            { path: "/settings", element: <Settings /> },
            { path: "/profile", element: <Profile /> },
            {
              path: "/navigation",
              element: (
                <ErrorBoundary>
                  <Navigation />
                </ErrorBoundary>
              ),
            },
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
            { path: "/notifications", element: <Notifications /> },
            {
              path: "/gallery",
              element: (
                <ErrorBoundary>
                  <Gallery />
                </ErrorBoundary>
              ),
            },
            {
              path: "/trips/:tripId/story",
              element: (
                <ErrorBoundary>
                  <StoryMode />
                </ErrorBoundary>
              ),
            },
          ],
        },
      ],
    },
    { path: "*", element: <NotFound /> },
]);

export default router;
