// file location: src/config/confirmation/user.js

/**
 * Canonical user records used for mock confirmation flows, HR previews, and dropdowns.
 * Keys are the preferred first-name identifiers; duplicate roles collapse into the same entry.
 */
export const confirmationUsers = {
  Alisha: {
    firstName: "Alisha",
    displayName: "Alisha",
    roles: ["Admin"],
    departments: ["Administration"],
  },
  Zedenca: {
    firstName: "Zedenca",
    displayName: "Zedenca",
    roles: ["Admin"],
    departments: ["Administration"],
  },
  Julie: {
    firstName: "Julie",
    displayName: "Julie",
    roles: ["Admin Manager"],
    departments: ["Administration"],
  },
  Ally: {
    firstName: "Ally",
    displayName: "Ally",
    roles: ["Accounts"],
    departments: ["Accounts"],
  },
  Paul: {
    firstName: "Paul",
    displayName: "Paul",
    roles: ["Accounts Manager", "Techs", "Valet Service"],
    departments: ["Accounts", "Workshop", "Valet"],
  },
  Marcus: {
    firstName: "Marcus",
    displayName: "Marcus",
    roles: ["Owner"],
    departments: ["Leadership"],
  },
  Owen: {
    firstName: "Owen",
    displayName: "Owen",
    roles: ["General Manager"],
    departments: ["Leadership"],
  },
  Sam: {
    firstName: "Sam",
    displayName: "Sam",
    roles: ["Sales Director"],
    departments: ["Sales"],
  },
  Josh: {
    firstName: "Josh",
    displayName: "Josh",
    roles: ["Sales"],
    departments: ["Sales"],
  },
  Brad: {
    firstName: "Brad",
    displayName: "Brad",
    roles: ["Sales"],
    departments: ["Sales"],
  },
  Richard: {
    firstName: "Richard",
    displayName: "Richard",
    roles: ["Sales"],
    departments: ["Sales"],
  },
  Rob: {
    firstName: "Rob",
    displayName: "Rob",
    roles: ["Sales"],
    departments: ["Sales"],
  },
  Nicola: {
    firstName: "Nicola",
    displayName: "Nicola",
    roles: ["Service"],
    departments: ["Service"],
  },
  Sharna: {
    firstName: "Sharna",
    displayName: "Sharna",
    roles: ["Service"],
    departments: ["Service"],
  },
  Darrell: {
    firstName: "Darrell",
    displayName: "Darrell",
    roles: ["Service Manager", "Workshop Manager"],
    departments: ["Service", "Workshop"],
  },
  Soren: {
    firstName: "Soren",
    displayName: "Soren",
    roles: ["After Sales Director"],
    departments: ["After Sales"],
  },
  Glen: {
    firstName: "Glen",
    displayName: "Glen",
    roles: ["Techs"],
    departments: ["Workshop"],
  },
  Michael: {
    firstName: "Michael",
    displayName: "Michael",
    roles: ["Techs"],
    departments: ["Workshop"],
  },
  Jake: {
    firstName: "Jake",
    displayName: "Jake",
    roles: ["Techs", "MOT Tester"],
    departments: ["Workshop"],
  },
  Scott: {
    firstName: "Scott",
    displayName: "Scott",
    roles: ["Techs", "Parts Manager"],
    departments: ["Workshop", "Parts"],
  },
  Cheryl: {
    firstName: "Cheryl",
    displayName: "Cheryl",
    roles: ["Techs"],
    departments: ["Workshop"],
  },
  Alister: {
    firstName: "Alister",
    displayName: "Alister",
    roles: ["Parts"],
    departments: ["Parts"],
  },
  Russel: {
    firstName: "Russel",
    displayName: "Russel",
    roles: ["MOT Tester"],
    departments: ["Workshop"],
  },
  Alex: {
    firstName: "Alex",
    displayName: "Alex",
    roles: ["Valet Sales"],
    departments: ["Valet"],
  },
  Harvey: {
    firstName: "Harvey",
    displayName: "Harvey",
    roles: ["Valet Sales"],
    departments: ["Valet"],
  },
  Peter: {
    firstName: "Peter",
    displayName: "Peter",
    roles: ["Valet Sales"],
    departments: ["Valet"],
  },
  Bruno: {
    firstName: "Bruno",
    displayName: "Bruno",
    roles: ["Buying Director"],
    departments: ["Sales"],
  },
  Sophie: {
    firstName: "Sophie",
    displayName: "Sophie",
    roles: ["Second Hand Buying"],
    departments: ["Sales"],
  },
  Grace: {
    firstName: "Grace",
    displayName: "Grace",
    roles: ["Vehicle Processor & Photographer"],
    departments: ["Sales"],
  },
  Carol: {
    firstName: "Carol",
    displayName: "Carol",
    roles: ["Receptionist"],
    departments: ["Front Desk"],
  },
  Guy: {
    firstName: "Guy",
    displayName: "Guy",
    roles: ["Painters"],
    departments: ["Bodyshop"],
    aliases: ["Guy 1", "Guy 2"],
  },
  Smart: {
    firstName: "Smart",
    displayName: "Smart Repair",
    roles: ["Contractors"],
    departments: ["Contractors"],
    aliases: ["Smart Repair"],
  },
  Paints: {
    firstName: "Paints",
    displayName: "Paints (grey van)",
    roles: ["Contractors"],
    departments: ["Contractors"],
    aliases: ["Paints (grey van)"],
  },
  Dent: {
    firstName: "Dent",
    displayName: "Dent Man",
    roles: ["Contractors"],
    departments: ["Contractors"],
    aliases: ["Dent Man"],
  },
  Wheel: {
    firstName: "Wheel",
    displayName: "Wheel Men",
    roles: ["Contractors"],
    departments: ["Contractors"],
    aliases: ["Wheel Men"],
  },
  Windscreen: {
    firstName: "Windscreen",
    displayName: "Windscreen Guy",
    roles: ["Contractors"],
    departments: ["Contractors"],
    aliases: ["Windscreen Guy"],
  },
  Key: {
    firstName: "Key",
    displayName: "Key Guy",
    roles: ["Contractors"],
    departments: ["Contractors"],
    aliases: ["Key Guy"],
  },
};

/**
 * Aliases allow us to look up a canonical confirmation user using any label used elsewhere.
 * Keys should match the strings referenced in usersByRole or other legacy lists.
 */
export const confirmationUserAliases = Object.entries(confirmationUsers).reduce(
  (acc, [key, profile]) => {
    acc[key] = key;
    acc[profile.displayName] = key;

    if (Array.isArray(profile.aliases)) {
      profile.aliases.forEach((alias) => {
        acc[alias] = key;
      });
    }

    return acc;
  },
  {
    "Jake (tech) - when Russel off": "Jake",
  }
);

/**
 * Helper to safely fetch a confirmation user record by any known name/alias.
 */
export const getConfirmationUser = (name) => {
  if (!name) return undefined;
  const lookupKey =
    confirmationUserAliases[name] ||
    confirmationUserAliases[name.trim()] ||
    confirmationUserAliases[name.trim().replace(/\s+/g, " ")] ||
    null;

  if (lookupKey && confirmationUsers[lookupKey]) {
    return confirmationUsers[lookupKey];
  }

  const normalized = String(name || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s-\s.*$/, "")
    .trim();

  if (normalized && confirmationUsers[normalized]) {
    return confirmationUsers[normalized];
  }

  return undefined;
};
