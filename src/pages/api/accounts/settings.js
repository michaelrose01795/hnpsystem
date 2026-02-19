// file location: src/pages/api/accounts/settings.js
import createHandler from "@/lib/api/createHandler";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const TABLE = "account_settings";

export default createHandler({
  allowedRoles,
  methods: {
    GET: async (req, res) => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("settings")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        console.error("Failed to load account settings", error);
        res.status(200).json({ success: true, data: {} });
        return;
      }
      res.status(200).json({ success: true, data: data?.settings || {} });
    },
    PUT: async (req, res) => {
      const payload = req.body || {};
      const { error } = await supabase
        .from(TABLE)
        .upsert({ id: 1, settings: payload }, { onConflict: "id" });
      if (error) {
        console.error("Failed to save account settings", error);
        res.status(500).json({ success: false, message: "Unable to save settings" });
        return;
      }
      res.status(200).json({ success: true, data: payload });
    },
  },
});
