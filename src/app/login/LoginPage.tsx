import React, { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../AuthContext";

const fakeUsers = [
  { username: "tech1", password: "pass123", department: "Workshop" },
  { username: "admin1", password: "admin123", department: "Admin" },
  { username: "sales1", password: "sales123", department: "Car Sales" },
  { username: "parts1", password: "parts123", department: "Parts" },
];

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("Workshop");
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = () => {
    const user = fakeUsers.find(
      (u) =>
        u.username === username &&
        u.password === password &&
        u.department === department
    );

    if (user) {
      setError("");
      login(user.username, user.department); // store in context
      switch (user.department) {
        case "Workshop":
          router.push("/dashboard/workshop");
          break;
        case "Admin":
          router.push("/dashboard/admin");
          break;
        case "Car Sales":
          router.push("/dashboard/sales");
          break;
        case "Parts":
          router.push("/dashboard/parts");
          break;
        default:
          router.push("/dashboard");
      }
    } else {
      setError("Invalid username, password, or department");
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
      >
        <option value="Workshop">Workshop</option>
        <option value="Admin">Admin</option>
        <option value="Car Sales">Car Sales</option>
        <option value="Parts">Parts</option>
      </select>
      <button onClick={handleLogin}>Login</button>
      <p className="forgot-password">Forgot Password?</p>
    </div>
  );
};

export default LoginPage;
