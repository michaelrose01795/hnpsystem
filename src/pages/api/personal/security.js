import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  clearPersonalUnlockCookie,
  ensureDefaultPersonalSetup,
  getPersonalDb,
  getPersonalSecurityRow,
  getPersonalSecurityState,
  hashPasscode,
  isValidPasscode,
  PERSONAL_TABLES,
  setPersonalUnlockCookie,
  verifyPasscode,
} from "@/lib/profile/personalServer";

async function handler(req, res, session) {
  const db = getPersonalDb();

  try {
    if (req.method === "GET") {
      const state = await getPersonalSecurityState(req, res, db);
      return res.status(200).json({
        success: true,
        data: {
          isSetup: state.isSetup,
          isUnlocked: state.isUnlocked,
        },
      });
    }

    if (req.method === "POST") {
      const state = await getPersonalSecurityState(req, res, db);
      const action = String(req.body?.action || "").toLowerCase();

      if (action === "setup") {
        const passcode = String(req.body?.passcode || "");
        const confirmPasscode = String(req.body?.confirmPasscode || "");
        if (!isValidPasscode(passcode)) {
          return res.status(400).json({ success: false, message: "Passcode must be exactly 4 digits." });
        }
        if (passcode !== confirmPasscode) {
          return res.status(400).json({ success: false, message: "Passcodes do not match." });
        }
        if (state.isSetup) {
          return res.status(409).json({ success: false, message: "Personal passcode has already been set up." });
        }

        const payload = {
          user_id: state.userId,
          passcode_hash: hashPasscode(passcode),
          is_setup: true,
          updated_at: new Date().toISOString(),
        };

        const query = state.security
          ? db.from(PERSONAL_TABLES.security).update(payload).eq("user_id", state.userId)
          : db.from(PERSONAL_TABLES.security).insert({
              ...payload,
              created_at: new Date().toISOString(),
            });

        const { error } = await query;
        if (error) {
          throw error;
        }

        setPersonalUnlockCookie(res, state.userId);
        const personalState = await ensureDefaultPersonalSetup(state.userId, db);

        return res.status(200).json({
          success: true,
          data: {
            isSetup: true,
            isUnlocked: true,
            personalState,
          },
        });
      }

      if (action === "unlock") {
        const passcode = String(req.body?.passcode || "");
        const securityRow = state.security || (await getPersonalSecurityRow(state.userId, db));
        if (!securityRow?.is_setup || !securityRow?.passcode_hash) {
          return res.status(428).json({ success: false, message: "Personal passcode setup is required first." });
        }
        if (!verifyPasscode(passcode, securityRow.passcode_hash)) {
          return res.status(401).json({ success: false, message: "Incorrect passcode." });
        }

        setPersonalUnlockCookie(res, state.userId);
        const personalState = await ensureDefaultPersonalSetup(state.userId, db);

        return res.status(200).json({
          success: true,
          data: {
            isSetup: true,
            isUnlocked: true,
            personalState,
          },
        });
      }

      if (action === "lock") {
        clearPersonalUnlockCookie(res);
        return res.status(200).json({
          success: true,
          data: {
            isSetup: state.isSetup,
            isUnlocked: false,
          },
        });
      }

      if (action === "reset") {
        const { error } = await db
          .from(PERSONAL_TABLES.security)
          .delete()
          .eq("user_id", state.userId);

        if (error) {
          throw error;
        }

        clearPersonalUnlockCookie(res);
        return res.status(200).json({
          success: true,
          data: {
            isSetup: false,
            isUnlocked: false,
          },
        });
      }

      return res.status(400).json({ success: false, message: "Unsupported security action." });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle personal security request.");
  }
}

export default withRoleGuard(handler);
