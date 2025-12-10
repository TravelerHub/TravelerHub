import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <nav>
      <button onClick={() => navigate('AboutUsPage')}>About Us</button>
      <button onClick={() => navigate('ServicePage')}>Service</button>
      <button onClick={() => navigate('FeedbackPage')}>Feedback</button>
      <button onClick={() => navigate('ContactUsPage')}>Contact Us</button>
      <button>Log in / Sign up</button>
    </nav>
  );
}

export default LandingPage;