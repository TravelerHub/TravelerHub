import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import AboutUsPage from "./pages/AboutUsPage.jsx";
import ContactUsPage from "./pages/ContactUsPage.jsx";
import ServicePage from "./pages/ServicePage.jsx";
import FeedbackPage from "./pages/FeedbackPage.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/AboutUsPage" element={<AboutUsPage />} />
        <Route path="/ContactUsPage" element={<ContactUsPage />} />
        <Route path="/ServicePage" element={<ServicePage />} />
        <Route path="/FeedbackPage" element={<FeedbackPage />} />
      </Routes>
    </Router>
  );
}

export default App;