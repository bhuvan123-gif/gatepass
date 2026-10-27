
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
