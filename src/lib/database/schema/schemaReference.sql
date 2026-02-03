[
  {
    "schema_name": "auth",
    "table_name": "audit_log_entries",
    "column_name": "instance_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "audit_log_entries",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "audit_log_entries",
    "column_name": "payload",
    "data_type": "json",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "audit_log_entries",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "audit_log_entries",
    "column_name": "ip_address",
    "data_type": "character varying",
    "character_maximum_length": 64,
    "is_nullable": "NO",
    "column_default": "''::character varying"
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "auth_code",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "code_challenge_method",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "code_challenge",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "provider_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "provider_access_token",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "provider_refresh_token",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "authentication_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "flow_state",
    "column_name": "auth_code_issued_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "provider_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "identity_data",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "provider",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "last_sign_in_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "identities",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "auth",
    "table_name": "instances",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "instances",
    "column_name": "uuid",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "instances",
    "column_name": "raw_base_config",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "instances",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "instances",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "session_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "authentication_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "factor_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "verified_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "ip_address",
    "data_type": "inet",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "otp_code",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_challenges",
    "column_name": "web_authn_session_data",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "friendly_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "factor_type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "secret",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "last_challenged_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "web_authn_credential",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "web_authn_aaguid",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "mfa_factors",
    "column_name": "last_webauthn_challenge_data",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "authorization_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "client_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "redirect_uri",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "scope",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "state",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "resource",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "code_challenge",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "code_challenge_method",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "response_type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'code'::auth.oauth_response_type"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'pending'::auth.oauth_authorization_status"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "authorization_code",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "expires_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "(now() + '00:03:00'::interval)"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "approved_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_authorizations",
    "column_name": "nonce",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_client_states",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_client_states",
    "column_name": "provider_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_client_states",
    "column_name": "code_verifier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_client_states",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "client_secret_hash",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "registration_type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "redirect_uris",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "grant_types",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "client_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "client_uri",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "logo_uri",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "deleted_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_clients",
    "column_name": "client_type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'confidential'::auth.oauth_client_type"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_consents",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_consents",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_consents",
    "column_name": "client_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_consents",
    "column_name": "scopes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_consents",
    "column_name": "granted_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "auth",
    "table_name": "oauth_consents",
    "column_name": "revoked_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "token_type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "token_hash",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "relates_to",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "auth",
    "table_name": "one_time_tokens",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "instance_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('auth.refresh_tokens_id_seq'::regclass)"
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "token",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "user_id",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "revoked",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "parent",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "refresh_tokens",
    "column_name": "session_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "sso_provider_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "entity_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "metadata_xml",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "metadata_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "attribute_mapping",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_providers",
    "column_name": "name_id_format",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "sso_provider_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "request_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "for_email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "redirect_to",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "saml_relay_states",
    "column_name": "flow_state_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "schema_migrations",
    "column_name": "version",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "factor_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "aal",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "not_after",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "refreshed_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "user_agent",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "ip",
    "data_type": "inet",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "tag",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "oauth_client_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "refresh_token_hmac_key",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "refresh_token_counter",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sessions",
    "column_name": "scopes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_domains",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_domains",
    "column_name": "sso_provider_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_domains",
    "column_name": "domain",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_domains",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_domains",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_providers",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_providers",
    "column_name": "resource_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_providers",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_providers",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "sso_providers",
    "column_name": "disabled",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "instance_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "aud",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "role",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "encrypted_password",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email_confirmed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "invited_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "confirmation_token",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "confirmation_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "recovery_token",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "recovery_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email_change_token_new",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email_change",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email_change_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "last_sign_in_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "raw_app_meta_data",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "raw_user_meta_data",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "is_super_admin",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "NULL::character varying"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "phone_confirmed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "phone_change",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "''::character varying"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "phone_change_token",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": "''::character varying"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "phone_change_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "confirmed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email_change_token_current",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": "''::character varying"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "email_change_confirm_status",
    "data_type": "smallint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "banned_until",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "reauthentication_token",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "YES",
    "column_default": "''::character varying"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "reauthentication_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "is_sso_user",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "deleted_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "auth",
    "table_name": "users",
    "column_name": "is_anonymous",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "userid",
    "data_type": "oid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "dbid",
    "data_type": "oid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "toplevel",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "queryid",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "query",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "plans",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "total_plan_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "min_plan_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "max_plan_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "mean_plan_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "stddev_plan_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "calls",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "total_exec_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "min_exec_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "max_exec_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "mean_exec_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "stddev_exec_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "rows",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "shared_blks_hit",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "shared_blks_read",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "shared_blks_dirtied",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "shared_blks_written",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "local_blks_hit",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "local_blks_read",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "local_blks_dirtied",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "local_blks_written",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "temp_blks_read",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "temp_blks_written",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "shared_blk_read_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "shared_blk_write_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "local_blk_read_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "local_blk_write_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "temp_blk_read_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "temp_blk_write_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "wal_records",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "wal_fpi",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "wal_bytes",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_functions",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_generation_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_inlining_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_inlining_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_optimization_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_optimization_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_emission_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_emission_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_deform_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "jit_deform_time",
    "data_type": "double precision",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "stats_since",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements",
    "column_name": "minmax_stats_since",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements_info",
    "column_name": "dealloc",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "extensions",
    "table_name": "pg_stat_statements_info",
    "column_name": "stats_reset",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "transaction_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "account_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "transaction_date",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "amount",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'Debit'::text"
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "payment_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "created_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "account_transactions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "account_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "account_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'Retail'::text"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "balance",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "credit_limit",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'Active'::text"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_address_line1",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_address_line2",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_city",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_postcode",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "billing_country",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "credit_terms",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "30"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "accounts",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "appointment_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('appointments_appointment_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "scheduled_time",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "status",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": "'booked'::character varying"
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "appointments",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('clocking_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "CURRENT_DATE"
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "clock_in",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "clock_out",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "break_start",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "break_end",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "total_hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "status",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": "'clocked_out'::character varying"
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "clocking",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "account_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "company_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "trading_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "contact_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "contact_email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "contact_phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "billing_address_line1",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "billing_address_line2",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "billing_city",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "billing_postcode",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "billing_country",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'United Kingdom'::text"
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "linked_account_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "company_accounts",
    "column_name": "linked_account_label",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "company_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "address_line1",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "address_line2",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "city",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "postcode",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "phone_service",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "phone_parts",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "website",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "bank_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "sort_code",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "account_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "account_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "payment_reference_hint",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "updated_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "company_profile_settings",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "setting_key",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "setting_value",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "setting_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'string'::text"
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "updated_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "company_settings",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "consumable_locations",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "consumable_locations",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "consumable_locations",
    "column_name": "order_index",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "consumable_locations",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "consumable_stock_checks",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "consumable_stock_checks",
    "column_name": "consumable_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "consumable_stock_checks",
    "column_name": "technician_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "consumable_stock_checks",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "consumable_stock_checks",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "consumables",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "consumables",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "consumables",
    "column_name": "location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "consumables",
    "column_name": "location_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "consumables",
    "column_name": "temporary",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "consumables",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "event_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "activity_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "activity_source",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "activity_payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "occurred_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_activity_events",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "history_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "status_snapshot",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "vehicle_reg",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "vehicle_make_model",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "mileage_at_service",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "recorded_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_job_history",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "method_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "nickname",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "card_brand",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "last4",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "expiry_month",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "expiry_year",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "is_default",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "customer_payment_methods",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "link_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "relationship",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'owner'::text"
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "is_primary",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customer_vehicle_links",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "firstname",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "lastname",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "mobile",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "telephone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "postcode",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "contact_preference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'email'::text"
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "customers",
    "column_name": "slug_key",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "delivery_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "driver_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "vehicle_reg",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "fuel_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "deliveries",
    "column_name": "vehicle_mpg",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_settings",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_settings",
    "column_name": "diesel_price_per_litre",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_settings",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "delivery_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "stop_number",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "postcode",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "mileage_for_leg",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "estimated_fuel_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'planned'::text"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "delivery_stops",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "absence_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_absences_absence_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "start_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "end_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "approval_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'Pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "approved_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_absences",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "case_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_disciplinary_cases_case_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "incident_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "incident_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "severity",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'open'::text"
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_disciplinary_cases",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "profile_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_employee_profiles_profile_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "department",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "job_title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "employment_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "start_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "manager_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "photo_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "emergency_contact",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "documents",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "employment_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "contracted_hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "hourly_rate",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "overtime_rate",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "annual_salary",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "payroll_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "national_insurance_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "keycloak_user_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_employee_profiles",
    "column_name": "home_address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "adjustment_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_payroll_adjustments_adjustment_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "payroll_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "amount",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "reason",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_adjustments",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_runs",
    "column_name": "payroll_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_payroll_runs_payroll_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_runs",
    "column_name": "period_start",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_runs",
    "column_name": "period_end",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_runs",
    "column_name": "processed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_runs",
    "column_name": "processed_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_payroll_runs",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'draft'::text"
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "review_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_performance_reviews_review_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "reviewer_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "scheduled_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "score",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'scheduled'::text"
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_performance_reviews",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "assignment_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_training_assignments_assignment_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "course_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "assigned_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "assigned_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "due_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'assigned'::text"
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_assignments",
    "column_name": "certificate_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_courses",
    "column_name": "course_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('hr_training_courses_course_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_courses",
    "column_name": "title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_courses",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_courses",
    "column_name": "category",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_courses",
    "column_name": "renewal_interval_months",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "hr_training_courses",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_items",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_items",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_items",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_items",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_items",
    "column_name": "total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "payment_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "amount",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "payment_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "payment_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "CURRENT_DATE"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_payments",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "request_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "retail",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "qty",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "net_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "vat_amount",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_request_items",
    "column_name": "vat_rate",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "20"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "request_number",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "labour_net",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "labour_vat",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoice_requests",
    "column_name": "labour_vat_rate",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "20"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "total_parts",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "total_labour",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "total_vat",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "paid",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "payment_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "sent_email_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "sent_portal_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "account_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "labour_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "parts_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "consumables_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "vat",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "grand_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "payment_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'Draft'::text"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "due_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "invoice_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "order_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "account_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "invoice_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "CURRENT_DATE"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "invoice_to",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "deliver_to",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "vehicle_details",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "service_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "vat_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "invoices",
    "column_name": "invoice_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "request_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "waiting_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "submitted_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "submitted_by_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "submitted_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "approved_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "approved_by_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "approved_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "confirmation_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "price_estimate",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "estimated_completion",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "loan_car_details",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "confirmation_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_booking_requests",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "checkbox_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "sheet_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "label",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "position_x",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "position_y",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "is_checked",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheet_checkboxes",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "sheet_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "file_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "file_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "file_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "storage_path",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "signature_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_check_sheets",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('job_clocking_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "clock_in",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "clock_out",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "work_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'initial'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_clocking",
    "column_name": "request_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_cosmetic_damage",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_cosmetic_damage",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_cosmetic_damage",
    "column_name": "has_damage",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "job_cosmetic_damage",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_cosmetic_damage",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_cosmetic_damage",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_customer_statuses",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_customer_statuses",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_customer_statuses",
    "column_name": "customer_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'Neither'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_customer_statuses",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_customer_statuses",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "file_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('job_files_file_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "file_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "file_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "file_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "uploaded_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "folder",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'general'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_files",
    "column_name": "uploaded_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "note_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('job_notes_note_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "note_text",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "hidden_from_customer",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "true"
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "last_updated_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "linked_request_index",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "linked_vhc_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "linked_request_indices",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "linked_vhc_ids",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "linked_part_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_notes",
    "column_name": "linked_part_ids",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "status_updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_progress_view",
    "column_name": "completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "request_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "job_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'Customer'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "sort_order",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'inprogress'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "request_source",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'customer_request'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "vhc_item_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "parts_job_item_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "pre_pick_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_requests",
    "column_name": "note_text",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_share_links",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "job_share_links",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_share_links",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_share_links",
    "column_name": "link_code",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_share_links",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('job_status_history_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "from_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "to_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "changed_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "reason",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_history",
    "column_name": "changed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "from_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "to_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "changed_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "reason",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "changed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "next_change",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_status_timeline",
    "column_name": "hours_in_status",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "task_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('job_writeup_tasks_task_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "source",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "source_key",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "label",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'additional_work'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeup_tasks",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "writeup_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('job_writeups_writeup_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "technician_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "work_performed",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "parts_used",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "recommendations",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "labour_time",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "ratification",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "warranty_claim",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "tsr_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "pwa_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "technical_bulletins",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "technical_signature",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "quality_control",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "qty",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "booked",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "cause_entries",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "completion_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'additional_work'::text"
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "rectification_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "job_description_snapshot",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "vhc_authorization_reference",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "job_writeups",
    "column_name": "task_checklist",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('jobs_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "customer",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vehicle_reg",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vehicle_make_model",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "waiting_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "job_source",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "job_categories",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "requests",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'Service'::text"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'New'::text"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "assigned_to",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "cosmetic_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vhc_required",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "maintenance_info",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "status_updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "status_updated_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "checked_in_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "workshop_started_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vhc_completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vhc_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "additional_work_authorized_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "additional_work_started_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "wash_started_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "parts_ordered_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "warranty_parts_ordered_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "warranty_qc_started_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "warranty_ready_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "mileage_at_service",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "completion_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "rectification_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "job_description_snapshot",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "vhc_authorization_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "task_checklist",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "warranty_linked_job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "warranty_vhc_master_job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "delivery_confirmed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "account_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "job_division",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'Retail'::text"
  },
  {
    "schema_name": "public",
    "table_name": "jobs",
    "column_name": "tech_completion_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "key_event_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('key_tracking_events_key_event_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "action",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "performed_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "occurred_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "key_tracking_events",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_thread_members",
    "column_name": "member_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('message_thread_members_member_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "message_thread_members",
    "column_name": "thread_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_thread_members",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_thread_members",
    "column_name": "role",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'member'::text"
  },
  {
    "schema_name": "public",
    "table_name": "message_thread_members",
    "column_name": "joined_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "message_thread_members",
    "column_name": "last_read_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "thread_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('message_threads_thread_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "thread_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'direct'::text"
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "unique_hash",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "message_threads",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "message_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('messages_message_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "sender_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "receiver_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "content",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "read",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "thread_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "metadata",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "messages",
    "column_name": "saved_forever",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "content",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "departments",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "ARRAY[]::text[]"
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "author",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "news_updates",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "notification_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('notifications_notification_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "type",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "message",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "read",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "target_role",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "notifications",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_periods",
    "column_name": "period_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('overtime_periods_period_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "overtime_periods",
    "column_name": "period_start",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_periods",
    "column_name": "period_end",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_periods",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'open'::text"
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "session_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('overtime_sessions_session_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "period_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "start_time",
    "data_type": "time without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "end_time",
    "data_type": "time without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "total_hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "approved_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "overtime_sessions",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "part_categories",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "part_categories",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_categories",
    "column_name": "keywords",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "ARRAY[]::text[]"
  },
  {
    "schema_name": "public",
    "table_name": "part_categories",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "part_categories",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "part_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "supplier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "order_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "qty_ordered",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "qty_received",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "delivery_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "part_delivery_logs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "category",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "supplier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "oem_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "barcode",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "qty_in_stock",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "qty_reserved",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "qty_on_order",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "reorder_level",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "storage_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "service_default_zone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "sales_default_zone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "stairs_default_zone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "is_active",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "created_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "updated_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_catalog",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "supplier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "order_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'ordering'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "expected_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "received_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "updated_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_deliveries",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "delivery_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "part_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "quantity_ordered",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "quantity_received",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'ordered'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "updated_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_items",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "invoice_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "customer_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "part_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "total_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "items",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "payment_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "is_paid",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "delivery_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "CURRENT_DATE"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "contact_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "contact_phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "contact_email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'scheduled'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "sort_order",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_jobs",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "delivery_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "time_leave",
    "data_type": "time without time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "time_arrive",
    "data_type": "time without time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "mileage",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "fuel_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "stops_count",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "destination_address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'planned'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_runs",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_settings",
    "column_name": "fuel_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_settings",
    "column_name": "price_per_litre",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_delivery_settings",
    "column_name": "last_updated",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "goods_in_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "supplier_account_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "supplier_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "supplier_address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "supplier_contact",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "invoice_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "delivery_note_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "invoice_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "price_level",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "scan_payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'draft'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "created_by_user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "created_by_auth_uuid",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "goods_in_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "line_number",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "part_catalog_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "main_part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "bin_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "franchise",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "retail_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "cost_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "discount_code",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "surcharge",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "quantity",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "claim_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "pack_size",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "vat_rate",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "sales_prices",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "purchase_details",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "dealer_details",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "stock_details",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "user_defined",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "link_metadata",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "sales_history",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "audi_metadata",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "additional_fields",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "online_store",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "attributes",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "added_to_job",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "job_allocation_payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "created_by_user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "created_by_auth_uuid",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_goods_in_items",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "job_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "part_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "quantity",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'booked'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_card_items",
    "column_name": "part_catalog_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "order_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "('P'::text || lpad((nextval('parts_job_cards_order_number_seq'::regclass))::text, 5, '0'::text))"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'draft'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "priority",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'normal'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "customer_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "customer_phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "customer_email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "customer_address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "vehicle_reg",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "vehicle_make",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "vehicle_model",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "vehicle_vin",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "vehicle_details",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_address",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_contact",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_phone",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_eta",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_window",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "delivery_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "invoice_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "invoice_total",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "invoice_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'draft'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "invoice_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "created_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_cards",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "part_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "quantity_requested",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "quantity_allocated",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "quantity_fitted",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "origin",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'vhc'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "pre_pick_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "storage_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "request_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "allocated_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "picked_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "fitted_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "created_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "updated_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "vhc_item_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "authorised",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "stock_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "eta_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "eta_time",
    "data_type": "time without time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "supplier_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "labour_hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "parts_job_items",
    "column_name": "allocated_to_request_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "total_parts_in_stock",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "stock_value",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "reserved_value",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "on_order_value",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "total_income",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "total_spending",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "outstanding_delivery_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_manager_summary",
    "column_name": "generated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "request_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('parts_requests_request_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "requested_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "approved_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "status",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": "'pending'::character varying"
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "part_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "source",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'manual'::text"
  },
  {
    "schema_name": "public",
    "table_name": "parts_requests",
    "column_name": "pre_pick_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "part_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "job_item_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "delivery_item_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "movement_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "unit_price",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "performed_by",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "parts_stock_movements",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "payment_links",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "payment_links",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_links",
    "column_name": "provider",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_links",
    "column_name": "checkout_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_links",
    "column_name": "expires_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "plan_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "invoice_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "total_amount",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "balance_due",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "frequency",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "next_payment_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'active'::text"
  },
  {
    "schema_name": "public",
    "table_name": "payment_plans",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "profiles",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "profiles",
    "column_name": "dark_mode",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "profiles",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "profiles",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "history_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "vehicle_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "deduct_from_payroll",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "recorded_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicle_history",
    "column_name": "payroll_processed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "vehicle_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "make",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "model",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "registration",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "vin",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "colour",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "payroll_deduction_enabled",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "payroll_deduction_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "staff_vehicles",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('time_records_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "clock_in",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "clock_out",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "hours_worked",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "break_minutes",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "time_records",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "last_checked",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "next_due",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "interval_days",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "interval_months",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_equipment_tools",
    "column_name": "interval_label",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "stock",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "last_check",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "next_check",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "last_topped_up",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "consumable_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "interval_days",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "interval_months",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "tracking_oil_stock",
    "column_name": "interval_label",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "user_signatures",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "user_signatures",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "user_signatures",
    "column_name": "storage_path",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "user_signatures",
    "column_name": "file_url",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "user_signatures",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "user_signatures",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "user_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('users_user_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "first_name",
    "data_type": "character varying",
    "character_maximum_length": 100,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "last_name",
    "data_type": "character varying",
    "character_maximum_length": 100,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "email",
    "data_type": "character varying",
    "character_maximum_length": 150,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "password_hash",
    "data_type": "character varying",
    "character_maximum_length": 255,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "role",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "phone",
    "data_type": "character varying",
    "character_maximum_length": 20,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "dark_mode",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "job_title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "event_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('vehicle_tracking_events_event_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "occurred_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vehicle_tracking_events",
    "column_name": "created_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "vehicle_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('vehicles_vehicle_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "reg_number",
    "data_type": "character varying",
    "character_maximum_length": 20,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "make",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "model",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "year",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "vin",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "owner_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "colour",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "engine_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "mileage",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "fuel_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "transmission",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "body_style",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "mot_due",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "service_history",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "warranty_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "warranty_expiry",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "insurance_provider",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "insurance_policy_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "customer_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "registration",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "make_model",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "chassis",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "engine",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "lease_co",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "privileges",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "service_plan_supplier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "service_plan_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "service_plan_expiry",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "engine_capacity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "tax_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "tax_due_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "co2_emissions",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "marked_for_export",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "wheelplan",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vehicles",
    "column_name": "month_of_first_registration",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('vhc_authorizations_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "authorized_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "authorized_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "authorized_items",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "customer_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorizations",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "vhc_item_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "section",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "issue_title",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "issue_description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "measurement",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "approval_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "display_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "labour_hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "parts_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "total_override",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "labour_complete",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "parts_complete",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "approved_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "approved_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "note_text",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "pre_pick_location",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "request_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_authorized_items",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "vhc_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('vhc_checks_vhc_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "section",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "issue_title",
    "data_type": "character varying",
    "character_maximum_length": 150,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "issue_description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "measurement",
    "data_type": "character varying",
    "character_maximum_length": 50,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "approval_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "labour_hours",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "parts_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "total_override",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "labour_complete",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "parts_complete",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "approved_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "approved_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "display_status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_checks",
    "column_name": "authorization_state",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'n/a'::text"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_declinations",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('vhc_declinations_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_declinations",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_declinations",
    "column_name": "declined_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_declinations",
    "column_name": "declined_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_declinations",
    "column_name": "customer_notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_declinations",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_item_aliases",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "uuid_generate_v4()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_item_aliases",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_item_aliases",
    "column_name": "display_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_item_aliases",
    "column_name": "vhc_item_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_item_aliases",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "timezone('utc'::text, now())"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_item_aliases",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "timezone('utc'::text, now())"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('vhc_send_history_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "sent_by",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "send_method",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "'email'::text"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "customer_email",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_send_history",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "vehicle_reg",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "vhc_required",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "vhc_completed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "vhc_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "vhc_authorization_reference",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "vhc_checks_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "authorization_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "declination_count",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "vhc_workflow_status",
    "column_name": "last_sent_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_budgets",
    "column_name": "budget_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('workshop_consumable_budgets_budget_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_budgets",
    "column_name": "year",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_budgets",
    "column_name": "month",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_budgets",
    "column_name": "monthly_budget",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_budgets",
    "column_name": "updated_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_budgets",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "order_id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "nextval('workshop_consumable_orders_order_id_seq'::regclass)"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "consumable_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "order_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "total_value",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "supplier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_orders",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "item_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "requested_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "requested_by_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "requested_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'pending'::text"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_requests",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "consumable_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "total_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "used_by",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "used_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumable_usage",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "item_name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "part_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "supplier",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "unit_cost",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "estimated_quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "last_order_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "next_estimated_order_date",
    "data_type": "date",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "last_order_quantity",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "last_order_total_value",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "reorder_frequency_days",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "30"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "is_required",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "workshop_consumables",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "job_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "job_number",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "writeup_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'waiting'::text"
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "is_additional_work",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "vhc_item_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "authorization_id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "authorized_amount",
    "data_type": "numeric",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "public",
    "table_name": "writeup_rectification_items",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_01_31",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_01",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_02",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_03",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_04",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_05",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "topic",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "extension",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "payload",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "event",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "private",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "realtime",
    "table_name": "messages_2026_02_06",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "realtime",
    "table_name": "schema_migrations",
    "column_name": "version",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "schema_migrations",
    "column_name": "inserted_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "id",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "subscription_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "entity",
    "data_type": "regclass",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "filters",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'{}'::realtime.user_defined_filter[]"
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "claims",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "claims_role",
    "data_type": "regrole",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "realtime",
    "table_name": "subscription",
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "timezone('utc'::text, now())"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "owner",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "public",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "avif_autodetection",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "file_size_limit",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "allowed_mime_types",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "owner_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "column_name": "type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'STANDARD'::storage.buckettype"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'ANALYTICS'::storage.buckettype"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "format",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'ICEBERG'::text"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_analytics",
    "column_name": "deleted_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_vectors",
    "column_name": "id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_vectors",
    "column_name": "type",
    "data_type": "USER-DEFINED",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "'VECTOR'::storage.buckettype"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_vectors",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets_vectors",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "migrations",
    "column_name": "id",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "migrations",
    "column_name": "name",
    "data_type": "character varying",
    "character_maximum_length": 100,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "migrations",
    "column_name": "hash",
    "data_type": "character varying",
    "character_maximum_length": 40,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "migrations",
    "column_name": "executed_at",
    "data_type": "timestamp without time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "CURRENT_TIMESTAMP"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "bucket_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "owner",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "last_accessed_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "metadata",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "path_tokens",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "version",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "owner_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "user_metadata",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "column_name": "level",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "prefixes",
    "column_name": "bucket_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "prefixes",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "prefixes",
    "column_name": "level",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "prefixes",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "prefixes",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "in_progress_size",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "upload_signature",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "bucket_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "key",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "version",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "owner_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "user_metadata",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "upload_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "size",
    "data_type": "bigint",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "part_number",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "bucket_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "key",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "etag",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "owner_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "version",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "bucket_id",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "data_type",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "dimension",
    "data_type": "integer",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "distance_metric",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "metadata_configuration",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "storage",
    "table_name": "vector_indexes",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "schema_name": "supabase_migrations",
    "table_name": "schema_migrations",
    "column_name": "version",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "supabase_migrations",
    "table_name": "schema_migrations",
    "column_name": "statements",
    "data_type": "ARRAY",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "supabase_migrations",
    "table_name": "schema_migrations",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "supabase_migrations",
    "table_name": "seed_files",
    "column_name": "path",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "supabase_migrations",
    "table_name": "seed_files",
    "column_name": "hash",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "secret",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "decrypted_secret",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "key_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "nonce",
    "data_type": "bytea",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "decrypted_secrets",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "name",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "description",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "''::text"
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "secret",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "key_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "nonce",
    "data_type": "bytea",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": "vault._crypto_aead_det_noncegen()"
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "CURRENT_TIMESTAMP"
  },
  {
    "schema_name": "vault",
    "table_name": "secrets",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "CURRENT_TIMESTAMP"
  }
]