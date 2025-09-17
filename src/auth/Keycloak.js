// auth/keycloak.js
import Keycloak from "keycloak-js";

// 🔹 Replace with your Keycloak server details
const keycloak = new Keycloak({
  url: "https://<your-keycloak-domain>/auth",
  realm: "<your-realm-name>",
  clientId: "<your-client-id>",
});

export default keycloak;
