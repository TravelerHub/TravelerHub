import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <nav>
      <button onClick={() => navigate("/about")}>About Us</button>
      <button onClick={() => navigate("/service")}>Service</button>
      <button onClick={() => navigate("/feedback")}>Feedback</button>
      <button onClick={() => navigate("/contactus")}>Contact Us</button>
      <button onClick={() => navigate("/login")}>Log in</button>
    </nav>
  );
}

export default Landing;