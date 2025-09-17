// src/app/login/LoginPage.tsx

import React, { useState } from "react"; // React and hooks for state
import { useRouter } from "next/router"; // Next.js router for navigation
import { useAuth } from "../AuthContext"; // custom hook for auth context

// Fake user database for demonstration/testing purposes
const fakeUsers = [
  { username: "tech1", password: "pass123", department: "Workshop" },
  { username: "admin1", password: "admin123", department: "Admin" },
  { username: "sales1", password: "sales123", department: "Car Sales" },
  { username: "parts1", password: "parts123", department: "Parts" },
];

const LoginPage = () => {
  const [username, setUsername] = useState(""); // username input state
  const [password, setPassword] = useState(""); // password input state
  const [department, setDepartment] = useState("Workshop"); // department selector
  const [error, setError] = useState(""); // error message state

  const router = useRouter(); // Next.js router
  const { login } = useAuth(); // get login function from auth context

  // handle login button click
  const handleLogin = () => {
    // find user in fake database that matches username, password, and department
    const user = fakeUsers.find(
      (u) =>
        u.username === username &&
        u.password === password &&
        u.department === department
    );

    if (user) {
      setError(""); // clear any previous errors
      login(user.username, user.department); // store user in auth context

      // redirect user based on their department
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
      setError("Invalid username, password, or department"); // show error if login fails
    }
  };

  return (
    <div className="login-container"> {/* main container */}
      <h2>Login</h2> {/* page title */}

      {error && <p className="error">{error}</p>} {/* show error message if exists */}

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)} // update username state
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)} // update password state
      />
      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)} // update department state
      >
        <option value="Workshop">Workshop</option>
        <option value="Admin">Admin</option>
        <option value="Car Sales">Car Sales</option>
        <option value="Parts">Parts</option>
      </select>

      <button onClick={handleLogin}>Login</button> {/* trigger login */}

      <p className="forgot-password">Forgot Password?</p> {/* optional link/info */}
    </div>
  );
};

export default LoginPage;
