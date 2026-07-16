import axios from 'axios';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export enum ValidationStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  UNVERIFIABLE = "UNVERIFIABLE", // Used when network/API fails
}

export interface TaxValidationResult {
  status: ValidationStatus;
  originalQuery: string;
  sanitizedQuery: string;
  provider: string;
  message: string;
  details: {
    businessName: string | null;
    commercialName: string | null;
    address: string | null;
    effectiveDate: string | null;
    validationMethod: string;
  } | null;
}

// ============================================================================
// CONSTANTS & MOCKS (Replace with your actual imports)
// ============================================================================
const REGEX_PATTERNS = {
  GST_HST: /^\d{9}RT\d{4}$/,
  QST: /^\d{10}TQ\d{4}$/,
};

const PROVIDERS = {
  VAT_API: "VAT_API",
  REVENU_QUEBEC: "REVENU_QUEBEC",
};

const CONFIG = {
  vatApiKey: process.env.VAT_API_KEY || "",
  gstApiTimeout: 5000,
  qstApiTimeout: 5000,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const sanitizeTaxNumber = (input: string): string => input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const verifyLuhn = (bn9: string): boolean => {
  // Add your actual Luhn implementation here
  return true; 
};

const handleAxiosError = (error: any, context: string): string => {
  return error.message || "An unknown network error occurred.";
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a GST/HST number.
 */
export async function validateGst(gstNumber: string): Promise<TaxValidationResult> {
  const sanitizedGst = sanitizeTaxNumber(gstNumber);

  // 1. Format Check
  if (!REGEX_PATTERNS.GST_HST.test(sanitizedGst)) {
    return {
      status: ValidationStatus.INVALID,
      originalQuery: gstNumber,
      sanitizedQuery: sanitizedGst,
      provider: PROVIDERS.VAT_API,
      message: "Invalid format. Expected 9 digits followed by RT and 4 digits.",
      details: null,
    };
  }

  // 2. Luhn Checksum
  if (!verifyLuhn(sanitizedGst.substring(0, 9))) {
    return {
      status: ValidationStatus.INVALID,
      originalQuery: gstNumber,
      sanitizedQuery: sanitizedGst,
      provider: PROVIDERS.VAT_API,
      message: "Business Number fails Luhn checksum.",
      details: null,
    };
  }

  // 3. API Verification
  if (!CONFIG.vatApiKey) {
    return {
      status: ValidationStatus.UNVERIFIABLE,
      originalQuery: gstNumber,
      sanitizedQuery: sanitizedGst,
      provider: PROVIDERS.VAT_API,
      message: "Format valid, but API Key is missing. Cannot verify live status.",
      details: null,
    };
  }

  try {
    const response = await axios.get(`http://localhost:3000/api/v1/validate/CA/${sanitizedGst}`, {
      headers: { Authorization: `Bearer ${CONFIG.vatApiKey}` },
      timeout: CONFIG.gstApiTimeout,
    });

    const isValid = !!response.data?.valid;
    return {
      status: isValid ? ValidationStatus.VALID : ValidationStatus.INVALID,
      originalQuery: gstNumber,
      sanitizedQuery: sanitizedGst,
      provider: PROVIDERS.VAT_API,
      message: isValid ? "GST number is valid." : "GST number is not registered/active.",
      details: {
        businessName: response.data?.company_name || "N/A",
        commercialName: null,
        address: response.data?.company_address || "Canada",
        effectiveDate: null,
        validationMethod: "API_LOOKUP",
      },
    };
  } catch (error) {
    console.error(`[GST Validation Failure]: ${error}`);
    return {
      status: ValidationStatus.UNVERIFIABLE,
      originalQuery: gstNumber,
      sanitizedQuery: sanitizedGst,
      provider: PROVIDERS.VAT_API,
      message: "Service temporarily unavailable. Format is valid, but live lookup failed.",
      details: null,
    };
  }
}

/**
 * Validates a QST number.
 */
export async function validateQst(qstNumber: string): Promise<TaxValidationResult> {
  const sanitizedQst = sanitizeTaxNumber(qstNumber);

  if (!REGEX_PATTERNS.QST.test(sanitizedQst)) {
    return {
      status: ValidationStatus.INVALID,
      originalQuery: qstNumber,
      sanitizedQuery: sanitizedQst,
      provider: PROVIDERS.REVENU_QUEBEC,
      message: "Invalid format. Expected 10 digits followed by TQ and 4 digits.",
      details: null,
    };
  }

  try {
    const response = await axios.get(`https://svcnab2b.revenuquebec.ca/2019/02/ValidationTVQ/${sanitizedQst}`, {
      timeout: CONFIG.qstApiTimeout,
    });

    const isRegistered = response.data?.Resultat?.StatutSousDossierUsager === "R";

    return {
      status: isRegistered ? ValidationStatus.VALID : ValidationStatus.INVALID,
      originalQuery: qstNumber,
      sanitizedQuery: sanitizedQst,
      provider: PROVIDERS.REVENU_QUEBEC,
      message: isRegistered ? "QST number is valid." : "Business is not active or registered.",
      details: {
        businessName: response.data?.Resultat?.NomEntreprise || null,
        commercialName: response.data?.Resultat?.RaisonSociale || null,
        address: "Québec, Canada",
        effectiveDate: response.data?.Resultat?.DateStatut || null,
        validationMethod: "API_LOOKUP",
      },
    };
  } catch (error) {
    console.warn(`[QST Validation live lookup failed]: ${error}`);
    return {
      status: ValidationStatus.UNVERIFIABLE,
      originalQuery: qstNumber,
      sanitizedQuery: sanitizedQst,
      provider: PROVIDERS.REVENU_QUEBEC,
      message: "Service temporarily unavailable. Format is valid, but live lookup failed.",
      details: null,
    };
  }
}