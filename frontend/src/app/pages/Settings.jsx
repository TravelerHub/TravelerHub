import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Settings has been merged into Profile.
// This redirect keeps any existing /settings links working.
function Settings() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/profile", { replace: true }); }, [navigate]);
  return null;
}

export default Settings;
