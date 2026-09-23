// file location: src/hooks/useTypingAssistSettings.js
//
// React binding for the typing assistant's preferences, personal dictionary
// and learned predictions (src/lib/typingAssist/settings.js). Used by the staff
// profile Typing panel and the customer portal settings row. Stays in step
// with the global controller and other tabs through the settings broadcast.

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TYPING_ASSIST_SETTINGS,
  clearLearnedModel,
  readPersonalDictionary,
  readTypingAssistSettings,
  removeFromPersonalDictionary,
  resetTypingAssistSettings,
  subscribeTypingAssist,
  writeTypingAssistSettings,
} from "@/lib/typingAssist/settings";

export default function useTypingAssistSettings() {
  const [settings, setSettings] = useState(DEFAULT_TYPING_ASSIST_SETTINGS);
  const [dictionary, setDictionary] = useState([]);

  useEffect(() => {
    const sync = () => {
      setSettings(readTypingAssistSettings());
      setDictionary(readPersonalDictionary());
    };
    sync();
    return subscribeTypingAssist(sync);
  }, []);

  const update = useCallback((patch) => setSettings(writeTypingAssistSettings(patch)), []);
  const reset = useCallback(() => setSettings(resetTypingAssistSettings()), []);
  const removeWord = useCallback((word) => setDictionary(removeFromPersonalDictionary(word)), []);
  const clearLearned = useCallback(() => clearLearnedModel(), []);

  return { settings, update, reset, dictionary, removeWord, clearLearned };
}
