
const API_BASE_URL = "https://gatepass-api-eb51.onrender.com";

export type Flat = {
  id: number;
  flat_number: string;
  building: string | null;
  created_at: string;
};

export async function getFlats(): Promise<Flat[]> {
  const response = await fetch(`${API_BASE_URL}/flats`);

  if (!response.ok) {
    throw new Error("Could not load flats from GatePass API");
  }

  return response.json();
}

export async function createFlat(
  flat_number: string,
  building: string
): Promise<Flat> {
  const response = await fetch(`${API_BASE_URL}/flats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      flat_number,
      building: building || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail || "Could not register flat"
    );
  }

  return response.json();
}

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
  const response = await fetch(`${API_BASE_URL}/residents`);

  if (!response.ok) {
    throw new Error("Could not load residents from GatePass API");
  }

  return response.json();
}

export async function createResident(
  full_name: string,
  flat_id: number,
  phone: string
): Promise<Resident> {
  const response = await fetch(`${API_BASE_URL}/residents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name,
      flat_id,
      phone: phone || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Could not register resident");
  }

  return response.json();
}


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
  const response = await fetch(`${API_BASE_URL}/visitors`);

  if (!response.ok) {
    throw new Error("Failed to load visitors");
  }

  return response.json();
}

export async function createVisitor(
  full_name: string,
  flat_id: number,
  phone: string,
  purpose: string
): Promise<Visitor> {
  const response = await fetch(`${API_BASE_URL}/visitors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      full_name,
      flat_id,
      phone,
      purpose,
    }),
  });
  
export async function checkoutVisitor(visitorId: number): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/visitors/${visitorId}/checkout`,
    { method: "PATCH" }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to check out visitor");
  }
}


  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to register visitor");
  }

  return response.json();
}
