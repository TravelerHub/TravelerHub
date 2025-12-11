import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "./../../supabaseClient.jsx";
import bcrypt from "bcryptjs";

function SignUp() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function _hashPassword(password) {
    const saltRounds = 10;

    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    return hashedPassword;
  }

  async function _SignUp(e) {
    e.preventDefault();
    setError("");
    // Check if email exists
    const { data: emailData, error: emailError } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (emailData) {
      setError("Email already exists!");
      return;
    }

    // Check if username exists
    const { data: usernameData, error: usernameError } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (usernameData) {
      setError("Username already exists!");
      return;
    }

    // Insert new user
    const hashedPassword = await _hashPassword(password);

    const { data, error: insertError } = await supabase
      .from("users")
      .insert([{
        email: email,
        username: username,
        password: hashedPassword,
      }])
      .single();

    if (insertError) {
      setError("Error creating account. Please try again!");
      return;
    }

    // Redirect to Dashboard
    navigate("/dashboard");
  }

  return (
    <div>
      <form onSubmit={_SignUp}>
        <h1>Sign Up</h1>

        <input
          type="email"
          placeholder="Enter your Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Enter your Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Enter your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Sign Up</button>
        
        <p>Already have an account? <Link to="/login">Log In</Link></p>
      </form>
      {error && <p>{error}</p>}
    </div>
  );
}

export default SignUp;