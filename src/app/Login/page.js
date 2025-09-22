//file: src/app/login/page.js
//notes: Login page route

import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Login</h1>
      <LoginForm />
    </main>
  );
}