// file location: src/lib/vehicles/registration.js
// UK registration input helpers. Extracted from the Create Job Card page so
// every page that offers a registration lookup (/new-job, /new-order) formats
// and normalises the plate identically.

export const normalizeUkRegistrationInput = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);

export const formatUkRegistration = (value) => {
  const registration = normalizeUkRegistrationInput(value);
  const patterns = [
    [/^(\d{3})([DX])(\d{1,3})$/, "$1 $2 $3"], // Diplomatic registrations: 123 D 456.
    [/^([A-Z]{2}\d{2})([A-Z]{1,3})$/, "$1 $2"], // Current registrations: AB12 CDE.
    [/^([A-Z]\d{1,3})([A-Z]{1,3})$/, "$1 $2"], // Prefix registrations: A123 BCD.
    [/^([A-Z]{1,3})(\d{1,3}[A-Z])$/, "$1 $2"], // Suffix registrations: ABC 123A.
    [/^([A-Z]{1,3})(\d{1,4})$/, "$1 $2"], // Northern Irish and dateless registrations: ABC 1234.
    [/^(\d{1,4})([A-Z]{1,3})$/, "$1 $2"], // Reverse dateless registrations: 123 ABC.
  ];

  const matchingPattern = patterns.find(([pattern]) => pattern.test(registration));
  return matchingPattern
    ? registration.replace(matchingPattern[0], matchingPattern[1])
    : registration;
};
