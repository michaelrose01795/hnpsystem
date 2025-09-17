// src/auth/keycloak.ts
const keycloak = {
  init: (p0: { onLoad: string; checkLoginIframe: boolean; }) => Promise.resolve(true), // always “authenticated”
  login: () => console.log("Login called"),
  logout: () => console.log("Logout called"),
};

export default keycloak;
