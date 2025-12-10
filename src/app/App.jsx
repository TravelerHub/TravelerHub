import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

import Landing from "./pages/Landing.jsx";
import About from "./pages/About.jsx";
import ContactUs from "./pages/ContactUs.jsx";
import Service from "./pages/Service.jsx";
import Feedback from "./pages/Feedback.jsx";

// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// );

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/AboutUsPage" element={<About />} />
        <Route path="/ContactUsPage" element={<ContactUs />} />
        <Route path="/ServicePage" element={<Service />} />
        <Route path="/FeedbackPage" element={<Feedback />} />
      </Routes>
    </Router>
  );
}

export default App;