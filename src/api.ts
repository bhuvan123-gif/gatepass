
const API_BASE_URL = "https://gatepass-api-eb51.onrender.com";

// Shared API request handler
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

// ===============================
// FLATS
// ===============================

export type Flat = {
  id: number;
  flat_number: string;
  building: string | null;
  created_at: string;
};

export async function getFlats(): Promise<Flat[]> {
  return apiRequest<Flat[]>("/flats");
}

export async function createFlat(
  flat_number: string,
  building: string
): Promise<Flat> {
  return apiRequest<Flat>("/flats", {
    method: "POST",
    body: JSON.stringify({
      flat_number: flat_number.trim(),
      building: building.trim() || null,
    }),
  });
}

// ===============================
// RESIDENTS
// ===============================

export type Resident = {
  id: number;
  full_name: string;
  flat_id: number;
  flat_number: string;
  building: string | null;
  phone: string | null;
  created_at: string;
};

export async function getResidents(): Promise<Resident[]> {
  return apiRequest<Resident[]>("/residents");
}

export async function createResident(
  full_name: string,
  flat_id: number,
  phone: string
): Promise<Resident> {
  return apiRequest<Resident>("/residents", {
    method: "POST",
    body: JSON.stringify({
      full_name: full_name.trim(),
      flat_id: Number(flat_id),
      phone: phone.trim() || null,
    }),
  });
}

// ===============================
// VISITORS
// ===============================

export type Visitor = {
  id: number;
  full_name: string;
  flat_id: number;
  flat_number: string;
  building: string | null;
  phone: string;
  purpose: string;
  status: string;
  created_at: string;
  exited_at: string | null;
};

export async function getVisitors(): Promise<Visitor[]> {
  return apiRequest<Visitor[]>("/visitors");
}

export async function createVisitor(
  full_name: string,
  flat_id: number,
  phone: string,
  purpose: string
): Promise<Visitor> {
  return apiRequest<Visitor>("/visitors", {
    method: "POST",
    body: JSON.stringify({
      full_name: full_name.trim(),
      flat_id: Number(flat_id),
      phone: phone.trim(),
      purpose: purpose.trim(),
    }),
  });
}

export async function checkoutVisitor(
  visitorId: number
): Promise<void> {
  await apiRequest<unknown>(`/visitors/${visitorId}/checkout`, {
    method: "PATCH",
  });
}

// ===============================
// SECONDARY PEOPLE
// ===============================

export type SecondaryPerson = {
  id: number;
  full_name: string;
  phone: string | null;
  category: string;
  resident_id: number;
  flat_id: number;
  active: boolean;
  created_at: string;
  primary_resident?: string;
  flat_number?: string;
};

export type SecondaryPersonCreate = {
  full_name: string;
  phone?: string;
  category: string;
  resident_id: number;
  flat_id: number;
};

export type SecondaryPersonCreated = SecondaryPerson & {
  qr_token: string;
};

export async function getSecondaryPeople(): Promise<SecondaryPerson[]> {
  return apiRequest<SecondaryPerson[]>("/secondary-people");
}

export async function createSecondaryPerson(
  person: SecondaryPersonCreate
): Promise<SecondaryPersonCreated> {
  return apiRequest<SecondaryPersonCreated>("/secondary-people", {
    method: "POST",
    body: JSON.stringify({
      ...person,
      full_name: person.full_name.trim(),
      phone: person.phone?.trim() || "",
      resident_id: Number(person.resident_id),
      flat_id: Number(person.flat_id),
    }),
  });
}

export async function validateSecondaryQR(
  token: string
): Promise<{
  valid: boolean;
  person: SecondaryPerson;
}> {
  return apiRequest("/qr/validate", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function deactivateSecondaryPerson(
  personId: number
): Promise<SecondaryPerson> {
  return apiRequest<SecondaryPerson>(
    `/secondary-people/${personId}/deactivate`,
    { method: "PATCH" }
  );
}

export type FlatQRCreated = {
  valid: boolean;
  type: "flat";
  flat: {
    id: number;
    flat_number: string;
    building: string | null;
  };
  qr_token: string;
};

export async function generateFlatQR(
  flatId: number
): Promise<FlatQRCreated> {
  return apiRequest<FlatQRCreated>(`/flats/${flatId}/qr`, {
    method: "POST",
  });
}

