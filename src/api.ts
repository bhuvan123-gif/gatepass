
export const API_BASE_URL = "https://gatepass-api-eb51.onrender.com";

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
      // Keep fallback error message.
    }

    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  return response.json();
}

function get<T>(endpoint: string) {
  return apiRequest<T>(endpoint);
}

function post<T>(endpoint: string, body: unknown) {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function remove(endpoint: string) {
  return apiRequest<void>(endpoint, { method: "DELETE" });
}


// -------------------- TYPES --------------------

export interface Flat {
  id: number;
  flat_number: string;
  building: string | null;
  created_at?: string;
}

export interface FlatCreate {
  flat_number: string;
  building?: string | null;
}

export interface FlatQRCreated {
  valid: boolean;
  type: "flat";
  flat: Flat;
  qr_token: string;
}

export interface Resident {
  id: number;
  full_name: string;
  flat_id: number;
  phone: string;
  flat_number?: string;
  building?: string | null;
  created_at?: string;
  is_active: boolean;
}

export interface ResidentCreate {
  full_name: string;
  flat_id: number;
  phone: string;
}

export interface Visitor {
  id: number;
  full_name: string;
  flat_id: number;
  flat_number: string;
  building: string | null;
  phone: string;
  purpose: string;
  status: string;
  created_at: string;
  exited_at?: string | null;
  vehicle_number?: string | null;
  is_archived?: boolean;
}

export interface VisitorCreate {
  full_name: string;
  flat_id: number;
  phone: string;
  purpose: string;
  vehicle_number?: string | null;
}

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

export interface SecondaryPersonQRCreated {
  valid: boolean;
  type: "secondary";
  person: SecondaryPerson;
  qr_token: string;
}

export interface QRValidationResult {
  valid: boolean;
  type: "flat" | "secondary";
  flat?: Flat;
  residents?: Resident[];
  person?: SecondaryPerson;
}

export type MovementAction = "Check In" | "Check Out";

export interface MovementCreate {
  action: MovementAction;
  vehicle_number?: string | null;
}

export interface ResidentMovement extends MovementCreate {
  id: number;
  resident_id: number;
  flat_id: number;
  created_at: string;
  full_name?: string;
  phone?: string;
  flat_number?: string;
  building?: string | null;
  status?: "Inside" | "Outside" | "Unknown";
}

export interface ProviderMovement extends MovementCreate {
  id: number;
  person_id: number;
  flat_id: number;
  created_at: string;
  full_name?: string;
  category?: string;
  flat_number?: string;
  building?: string | null;
  status?: "Inside" | "Outside" | "Unknown";
}


// -------------------- FLATS --------------------

export const getFlats = () => get<Flat[]>("/flats");

export const createFlat = (data: FlatCreate) =>
  post<Flat>("/flats", data);

export const deleteFlat = (id: number) =>
  remove(`/flats/${id}`);

export const generateFlatQR = (id: number) =>
  post<FlatQRCreated>(`/flats/${id}/qr`, {});


// -------------------- RESIDENTS --------------------

export const getResidents = () =>
  get<Resident[]>("/residents");

export const createResident = (data: ResidentCreate) =>
  post<Resident>("/residents", data);

export const deleteResident = (id: number) =>
  remove(`/residents/${id}`);


// -------------------- VISITORS --------------------

export const getVisitors = () =>
  get<Visitor[]>("/visitors");

export const createVisitor = (data: VisitorCreate) =>
  post<Visitor>("/visitors", data);

export const checkoutVisitor = (id: number) =>
  apiRequest<Visitor>(`/visitors/${id}/checkout`, {
    method: "PATCH",
  });

export const deleteVisitor = (id: number) =>
  remove(`/visitors/${id}`);


// -------------------- SERVICE PROVIDERS --------------------

export const getSecondaryPeople = () =>
  get<SecondaryPerson[]>("/secondary-people");

export const createSecondaryPerson = (data: SecondaryPersonCreate) =>
  post<SecondaryPersonCreated>("/secondary-people", data);

export const generateSecondaryPersonQR = (id: number) =>
  post<SecondaryPersonQRCreated>(`/secondary-people/${id}/qr`, {});

export const deleteSecondaryPerson = (id: number) =>
  remove(`/secondary-people/${id}`);


// -------------------- QR --------------------

export const validateQR = (token: string) =>
  post<QRValidationResult>("/qr/validate", { token });

export const validateSecondaryQR = validateQR;


// -------------------- RESIDENT MOVEMENTS --------------------

export const getResidentMovements = () =>
  get<ResidentMovement[]>("/resident-movements");

export const getCurrentResidentStatus = () =>
  get<ResidentMovement[]>("/resident-movements/current");

export const recordResidentMovement = (
  residentId: number,
  data: MovementCreate
) =>
  post<ResidentMovement>("/resident-movements", {
    resident_id: residentId,
    ...data,
  });


// -------------------- SERVICE PROVIDER MOVEMENTS --------------------

export const getProviderMovements = () =>
  get<ProviderMovement[]>("/secondary-person-movements");

export const getCurrentProviderStatus = () =>
  get<ProviderMovement[]>("/secondary-person-movements/current");

export const recordProviderMovement = (
  personId: number,
  data: MovementCreate
) =>
  post<ProviderMovement>("/secondary-person-movements", {
    person_id: personId,
    ...data,
  });


// -------------------- VISITOR LOGS --------------------

export const getVisitorAccessLogs = () =>
  get<Visitor[]>("/visitor-access-logs");
