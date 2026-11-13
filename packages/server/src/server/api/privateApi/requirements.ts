// A custom SIP configuration can still enforce debugging restrictions. Only
// the explicit disabled status establishes that the documented requirement is met.
export const isSipExplicitlyDisabled = (status: string): boolean =>
    /^System Integrity Protection status:\s*disabled\.\s*$/m.test((status ?? "").trim());

export const isLibraryValidationDisabled = (preference: string): boolean =>
    (preference ?? "").trim() === "1";
