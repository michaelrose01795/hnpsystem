// file location: src/pages/api/auth/[...nextauth].js
// NextAuth API route that enables Keycloak OIDC integration and extracts roles from tokens.
// Place this file under src/pages/api/auth/[...nextauth].js

import NextAuth from "next-auth"; // import NextAuth
import KeycloakProvider from "next-auth/providers/keycloak"; // import Keycloak provider
import jwtDecode from "jwt-decode"; // small helper to decode JWT payloads

export const authOptions = {
  // providers array - we add Keycloak as an OpenID Connect provider
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID, // client id from Keycloak
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET, // client secret from Keycloak
      issuer: process.env.KEYCLOAK_ISSUER, // issuer (realm) URL from Keycloak
    }),
  ],

  // security secret used by NextAuth to sign cookies & tokens
  secret: process.env.NEXTAUTH_SECRET,

  // callbacks let us access tokens and shape the session object sent to the client
  callbacks: {
    // jwt callback runs whenever a JWT is created (on sign in) or updated
    async jwt({ token, account }) {
      // if account object exists, this is the initial sign-in event
      if (account) {
        // save access token / id token for later use
        token.accessToken = account.access_token; // store access_token
        token.idToken = account.id_token; // store id_token

        // try to decode id_token (and fallback to access token) to extract roles
        try {
          // prefer id_token but if not present fallback to access_token
          const raw = account.id_token || account.access_token || null; // raw JWT string
          if (raw) {
            const decoded = jwtDecode(raw); // decode token payload
            // Keycloak often places roles in realm_access.roles or resource_access[clientId].roles
            token.roles =
              decoded?.realm_access?.roles ||
              decoded?.resource_access?.[process.env.KEYCLOAK_CLIENT_ID]?.roles ||
              []; // default empty array
          } else {
            token.roles = []; // no token → no roles
          }
        } catch (err) {
          // decoding failed — set empty roles to avoid crashes
          console.error("NextAuth: failed to decode token for roles", err);
          token.roles = [];
        }
      }
      // return modified token; NextAuth will persist it
      return token;
    },

    // session callback controls what the client receives when calling useSession()
    async session({ session, token }) {
      // ensure session.user exists
      session.user = session.user || {}; // default user object
      // attach our extracted roles and tokens to the session user
      session.user.roles = token.roles || []; // attach roles
      session.accessToken = token.accessToken || null; // attach access token for API calls
      session.idToken = token.idToken || null; // attach id token (if needed)
      return session; // return the enriched session object
    },
  },
};

// export default NextAuth configuration
export default NextAuth(authOptions);
