import Lottie from "lottie-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import welcomeAnim from "../../assets/images/Welcome.json";

export default function WelcomeAfterLogin() {
  const navigate = useNavigate();

  // Optional fallback in case onComplete doesn't fire
  useEffect(() => {
    const t = setTimeout(() => navigate("/dashboard"), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Lottie
        animationData={welcomeAnim}
        loop={false}
        autoplay
        onComplete={() => navigate("/dashboard")}
        style={{ width: 520, height: 220 }}
      />
    </div>
  );
}