export const API_BASE_URL =
  "https://gatepass-api-eb51.onrender.com";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the fallback message if the response isn't JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function post<T>(endpoint: string, body: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------- FLATS ----------------

export interface Flat {
  id: number;
  flat_number: string;
  building: string | null;
  created_at?: string;
}

export interface FlatCreate {
  flat_number: string;
  building?: string;
}

export function getFlats() {
  return apiRequest<Flat[]>("/flats");
}

export function createFlat(data: FlatCreate) {
  return post<Flat>("/flats", data);
}

export interface FlatQRCreated {
  valid: boolean;
  type: "flat";
  flat: Flat;
  qr_token: string;
}

export function generateFlatQR(flatId: number) {
  return post<FlatQRCreated>(`/flats/${flatId}/qr`, {});
}

// ---------------- RESIDENTS ----------------

export interface Resident {
  id: number;
  full_name: string;
  flat_id: number;
  phone: string;
  flat_number?: string;
  building?: string | null;
  created_at?: string;
}

export interface ResidentCreate {
  full_name: string;
  flat_id: number;
  phone?: string;
}

export function getResidents() {
  return apiRequest<Resident[]>("/residents");
}

export function createResident(data: ResidentCreate) {
  return post<Resident>("/residents", data);
}

// ---------------- VISITORS ----------------

export interface Visitor {
  id: number;
  full_name: string;
  flat_id: number;
  flat_number?: string;
  building?: string | null;
  phone: string;
  purpose: string;
  status: string;
  created_at: string;
  exited_at?: string | null;
}

export interface VisitorCreate {
  full_name: string;
  flat_id: number;
  phone: string;
  purpose: string;
}

export function getVisitors() {
  return apiRequest<Visitor[]>("/visitors");
}

export function createVisitor(data: VisitorCreate) {
  return post<Visitor>("/visitors", data);
}

export function checkoutVisitor(visitorId: number) {
  return apiRequest<Visitor>(`/visitors/${visitorId}/checkout`, {
    method: "PATCH",
  });
}

// ---------------- SERVICE PROVIDERS ----------------

export interface SecondaryPerson {
  id: number;
  full_name: string;
  phone: string;
  category: string;
  resident_id: number | null;
  flat_id: number;
  active: boolean;
  created_at?: string;
  primary_resident?: string | null;
  flat_number?: string;
  building?: string | null;
}

export interface SecondaryPersonCreate {
  full_name: string;
  phone: string;
  category: string;
  resident_id?: number | null;
  flat_id: number;
}

export interface SecondaryPersonCreated extends SecondaryPerson {
  qr_token: string;
}

export function getSecondaryPeople() {
  return apiRequest<SecondaryPerson[]>("/secondary-people");
}

export function createSecondaryPerson(data: SecondaryPersonCreate) {
  return post<SecondaryPersonCreated>("/secondary-people", data);
}

export function deactivateSecondaryPerson(personId: number) {
  return apiRequest<SecondaryPerson>(
    `/secondary-people/${personId}/deactivate`,
    { method: "PATCH" }
  );
}

// ---------------- QR VALIDATION ----------------

export interface FlatQRValidation {
  valid: true;
  type: "flat";
  flat: Flat;
  residents: Resident[];
}

export interface SecondaryQRValidation {
  valid: true;
  type: "secondary";
  person: SecondaryPerson;
}

export type QRValidationResult =
  | FlatQRValidation
  | SecondaryQRValidation;

export function validateQR(token: string) {
  return post<QRValidationResult>("/qr/validate", { token });
}

// Backward-compatible alias if another component still uses this name.
export function validateSecondaryQR(token: string) {
  return validateQR(token);
}

// ---------------- RESIDENT MOVEMENTS ----------------

export type MovementAction = "Check In" | "Check Out";

export interface ResidentMovement {
  id: number;
  resident_id: number;
  flat_id: number;
  action: MovementAction;
  created_at: string;
  full_name?: string;
  phone?: string;
  flat_number?: string;
  building?: string | null;
  status?: "Inside" | "Outside";
}

export interface CurrentResidentStatus {
  resident_id: number;
  full_name: string;
  flat_id: number;
  flat_number: string;
  building: string | null;
  action: MovementAction | null;
  created_at: string | null;
  status: "Inside" | "Outside" | "Unknown";
}

export function getResidentMovements() {
  return apiRequest<ResidentMovement[]>("/resident-movements");
}

export function getCurrentResidentStatus() {
  return apiRequest<CurrentResidentStatus[]>(
    "/resident-movements/current"
  );
}

export function recordResidentMovement(
  residentId: number,
  action: MovementAction
) {
  return post<ResidentMovement>("/resident-movements", {
    resident_id: residentId,
    action,
  });
}
