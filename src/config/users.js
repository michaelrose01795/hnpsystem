// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

// file located at: src/config/users.js
// Map retail vs sales departments to provide grouped developer login options
export const roleCategories = {
  Retail: [
    "Service",
    "Service Manager",
    "Workshop Manager",
    "After Sales Director",
    "Techs",
    "Parts",
    "Parts Manager",
    "Parts Driver",
    "MOT Tester",
    "Valet Service",
  ],
  Sales: [
    "Sales Director",
    "Sales",
    "Admin",
    "Admin Manager",
    "Accounts",
    "Accounts Manager",
    "Owner",
    "General Manager",
    "Valet Sales",
    "Buying Director",
    "Second Hand Buying",
    "Vehicle Processor & Photographer",
    "Receptionist",
    "Painters",
    "Contractors",
  ],
  Customers: ["Customer"],
};
