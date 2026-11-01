import { useCallback, useEffect, useState } from "react";
import {
  getFlats,
  createFlat,
  getResidents,
  createResident,
  getVisitors,
  createVisitor,
  checkoutVisitor,
  getSecondaryPeople,
  createSecondaryPerson,
  deactivateSecondaryPerson,
  generateFlatQR,
  validateQR,
  getResidentMovements,
  getCurrentResidentStatus,
  recordResidentMovement,
  type Flat,
  type Resident,
  type Visitor,
  type SecondaryPerson,
  type SecondaryPersonCreated,
  type FlatQRCreated,
  type QRValidationResult,
  type ResidentMovement,
  type CurrentResidentStatus,
  type MovementAction,
} from "./api";

import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";


type Page =
  | "Dashboard"
  | "Residents"
  | "Service Providers"
  | "Visitors"
  | "Access Logs"
  | "Settings";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [flats, setFlats] = useState<Flat[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [providers, setProviders] = useState<SecondaryPerson[]>([]);
  const [movements, setMovements] = useState<ResidentMovement[]>([]);
  const [currentStatuses, setCurrentStatuses] = useState<
    CurrentResidentStatus[]
  >([]);

  const [flatNumber, setFlatNumber] = useState("");
  const [building, setBuilding] = useState("");

  const [residentName, setResidentName] = useState("");
  const [residentPhone, setResidentPhone] = useState("");
  const [residentFlat, setResidentFlat] = useState("");

  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorPurpose, setVisitorPurpose] = useState("");
  const [visitorFlat, setVisitorFlat] = useState("");

  const [providerName, setProviderName] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [providerCategory, setProviderCategory] = useState("Maid");
  const [providerFlat, setProviderFlat] = useState("");
  const [providerResident, setProviderResident] = useState("");

  const [newProviderQR, setNewProviderQR] =
    useState<SecondaryPersonCreated | null>(null);

  const [flatQR, setFlatQR] = useState<FlatQRCreated | null>(null);
  const [flatQRLoading, setFlatQRLoading] = useState<number | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] =
    useState<QRValidationResult | null>(null);
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanning, setScanning] = useState(false);

  const [logSearch, setLogSearch] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        flatData,
        residentData,
        visitorData,
        providerData,
        movementData,
        statusData,
      ] = await Promise.all([
        getFlats(),
        getResidents(),
        getVisitors(),
        getSecondaryPeople(),
        getResidentMovements(),
        getCurrentResidentStatus(),
      ]);

      setFlats(flatData);
      setResidents(residentData);
      setVisitors(visitorData);
      setProviders(providerData);
      setMovements(movementData);
      setCurrentStatuses(statusData);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------------- FLATS ----------------

  async function handleCreateFlat(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createFlat({
        flat_number: flatNumber.trim(),
        building: building.trim() || undefined,
      });

      setFlatNumber("");
      setBuilding("");
      setMessage("Flat added successfully.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add flat");
    }
  }

  async function handleGenerateFlatQR(flat: Flat) {
    const confirmed = window.confirm(
      "Generate a new QR code for this flat?\n\n" +
        "This replaces the previous QR code. Any previously printed QR " +
        "for this flat will stop working."
    );

    if (!confirmed) return;

    setFlatQRLoading(flat.id);
    setFlatQR(null);

    try {
      const result = await generateFlatQR(flat.id);
      setFlatQR(result);
      setMessage(`New QR generated for flat ${flat.flat_number}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not generate QR"
      );
    } finally {
      setFlatQRLoading(null);
    }
  }

  // ---------------- RESIDENTS ----------------

  async function handleCreateResident(e: React.FormEvent) {
    e.preventDefault();

    if (!residentFlat) {
      setMessage("Select a flat first.");
      return;
    }

    try {
      await createResident({
        full_name: residentName.trim(),
        phone: residentPhone.trim(),
        flat_id: Number(residentFlat),
      });

      setResidentName("");
      setResidentPhone("");
      setResidentFlat("");
      setMessage("Resident added successfully.");
      await loadAll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not add resident"
      );
    }
  }

  // ---------------- VISITORS ----------------

  async function handleCreateVisitor(e: React.FormEvent) {
    e.preventDefault();

    if (!visitorFlat) {
      setMessage("Select a flat for this visitor.");
      return;
    }

    try {
      await createVisitor({
        full_name: visitorName.trim(),
        flat_id: Number(visitorFlat),
        phone: visitorPhone.trim(),
        purpose: visitorPurpose.trim(),
      });

      setVisitorName("");
      setVisitorPhone("");
      setVisitorPurpose("");
      setVisitorFlat("");
      setMessage("Visitor checked in successfully.");
      await loadAll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not register visitor"
      );
    }
  }

  async function handleVisitorCheckout(id: number) {
    try {
      await checkoutVisitor(id);
      setMessage("Visitor checked out.");
      await loadAll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not check out visitor"
      );
    }
  }

  // ---------------- SERVICE PROVIDERS ----------------

  async function handleCreateProvider(e: React.FormEvent) {
    e.preventDefault();

    if (!providerFlat) {
      setMessage("Select a flat for this service provider.");
      return;
    }

    try {
      const result = await createSecondaryPerson({
        full_name: providerName.trim(),
        phone: providerPhone.trim(),
        category: providerCategory,
        flat_id: Number(providerFlat),
        resident_id: providerResident
          ? Number(providerResident)
          : null,
      });

      setNewProviderQR(result);
      setProviderName("");
      setProviderPhone("");
      setProviderCategory("Maid");
      setProviderFlat("");
      setProviderResident("");
      setMessage("Service provider registered.");
      await loadAll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not register provider"
      );
    }
  }

  async function handleDeactivateProvider(id: number) {
    if (!window.confirm("Deactivate this service provider's QR code?")) {
      return;
    }

    try {
      await deactivateSecondaryPerson(id);
      setMessage("Service provider deactivated.");
      await loadAll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not deactivate provider"
      );
    }
  }

  // ---------------- QR SCANNER ----------------

  useEffect(() => {
    if (!scannerOpen) return;

    let scanner: Html5QrcodeScanner | null = null;
    let handled = false;

    const timer = window.setTimeout(() => {
      const element = document.getElementById("gatepass-qr-reader");
      if (!element) return;

      scanner = new Html5QrcodeScanner(
        "gatepass-qr-reader",
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
          rememberLastUsedCamera: true,
        },
        false
      );

      scanner.render(
        async (decodedText) => {
          if (handled) return;
          handled = true;

          try {
            setScanning(true);
            const result = await validateQR(decodedText);
            setScanResult(result);
            setScanMessage(
              result.type === "flat"
                ? `Flat ${result.flat.flat_number} verified. Select the resident.`
                : `Provider verified: ${result.person.full_name}`
            );

            await scanner?.clear();
          } catch (error) {
            handled = false;
            setScanMessage(
              error instanceof Error ? error.message : "QR validation failed"
            );
          } finally {
            setScanning(false);
          }
        },
        () => {
          // Ignore normal frame-by-frame scan failures.
        }
      );
    }, 250);

    return () => {
      window.clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(() => undefined);
      }
    };
  }, [scannerOpen]);

  function closeScanner() {
    setScannerOpen(false);
    setScanResult(null);
    setSelectedResidentId("");
    setScanMessage("");
    setScanning(false);
  }

  // ---------------- RESIDENT MOVEMENTS ----------------

  async function handleResidentMovement(action: MovementAction) {
    if (!selectedResidentId) {
      setScanMessage("Select a resident first.");
      return;
    }

    try {
      await recordResidentMovement(Number(selectedResidentId), action);
      setScanMessage(`${action} recorded successfully.`);
      await loadAll();

      // Keep the successful result visible briefly, then reset the scanner.
      window.setTimeout(() => {
        closeScanner();
      }, 900);
    } catch (error) {
      setScanMessage(
        error instanceof Error ? error.message : "Could not record movement"
      );
    }
  }

  function residentStatus(residentId: number) {
    const status = currentStatuses.find(
      (item) => item.resident_id === residentId
    );
    return status?.status || "Unknown";
  }

  // ---------------- DOWNLOAD QR ----------------

  function downloadQR(elementId: string, filename: string) {
    const svg = document.getElementById(elementId);

    if (!(svg instanceof SVGElement)) {
      setMessage("QR image could not be found.");
      return;
    }

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  // ---------------- UI HELPERS ----------------

  function flatLabel(flat: Flat) {
    return `${flat.flat_number}${flat.building ? ` · ${flat.building}` : ""}`;
  }

  function renderFlats() {
    return (
      <section className="panel">
        <h2>Flats</h2>

        <form onSubmit={handleCreateFlat} className="form-grid">
          <input
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="Flat number"
            required
          />

          <input
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Building / Block"
          />

          <button type="submit">Add Flat</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flat</th>
                <th>Building</th>
                <th>QR Code</th>
              </tr>
            </thead>
            <tbody>
              {flats.map((flat) => (
                <tr key={flat.id}>
                  <td>{flat.flat_number}</td>
                  <td>{flat.building || "—"}</td>
                  <td>
                    <button
                      onClick={() => handleGenerateFlatQR(flat)}
                      disabled={flatQRLoading === flat.id}
                    >
                      {flatQRLoading === flat.id
                        ? "Generating..."
                        : "Generate / Regenerate QR"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {flatQR && (
          <div className="qr-card">
            <h3>Flat QR Code</h3>
            <p>
              {flatQR.flat.flat_number}
              {flatQR.flat.building
                ? ` · ${flatQR.flat.building}`
                : ""}
            </p>

            <QRCodeSVG
              id="flat-qr-svg"
              value={flatQR.qr_token}
              size={220}
              level="H"
              includeMargin
            />

            <p>
              Print and place this QR at the resident entry point. Scanning it
              will ask the guard to select the resident.
            </p>

            <button
              onClick={() =>
                downloadQR(
                  "flat-qr-svg",
                  `GatePass-flat-${flatQR.flat.flat_number}.svg`
                )
              }
            >
              Download QR
            </button>

            <p className="warning">
              Regenerating this QR invalidates the previously printed QR.
            </p>
          </div>
        )}
      </section>
    );
  }

  function renderResidents() {
    return (
      <section className="panel">
        <h2>Residents</h2>

        <form onSubmit={handleCreateResident} className="form-grid">
          <input
            value={residentName}
            onChange={(e) => setResidentName(e.target.value)}
            placeholder="Resident full name"
            required
          />

          <input
            value={residentPhone}
            onChange={(e) => setResidentPhone(e.target.value)}
            placeholder="Phone (mandatory)"
          />

          <select
            value={residentFlat}
            onChange={(e) => setResidentFlat(e.target.value)}
            required
          >
            <option value="">Select flat</option>
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>
                {flatLabel(flat)}
              </option>
            ))}
          </select>

          <button type="submit">Add Resident</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Flat</th>
                <th>Phone</th>
                <th>Current Status</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((resident) => (
                <tr key={resident.id}>
                  <td>{resident.full_name}</td>
                  <td>{resident.flat_number || resident.flat_id}</td>
                  <td>{resident.phone || "—"}</td>
                  <td>{residentStatus(resident.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderProviders() {
    return (
      <section className="panel">
        <h2>Register Service Provider</h2>

        <form onSubmit={handleCreateProvider} className="form-grid">
          <input
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="Full name"
            required
          />

          <input
            value={providerPhone}
            onChange={(e) => setProviderPhone(e.target.value)}
            placeholder="Phone number"
            required
          />

          <select
            value={providerCategory}
            onChange={(e) => setProviderCategory(e.target.value)}
          >
            <option>Maid</option>
            <option>Milkman</option>
            <option>Driver</option>
            <option>Cook</option>
            <option>Vendor</option>
            <option>Other</option>
          </select>

          <select
            value={providerFlat}
            onChange={(e) => setProviderFlat(e.target.value)}
            required
          >
            <option value="">Select flat</option>
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>
                {flatLabel(flat)}
              </option>
            ))}
          </select>

          <select
            value={providerResident}
            onChange={(e) => setProviderResident(e.target.value)}
          >
            <option value="">Select linked resident (optional)</option>
            {residents
              .filter(
                (resident) =>
                  !providerFlat ||
                  resident.flat_id === Number(providerFlat)
              )
              .map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.full_name}
                </option>
              ))}
          </select>

          <button type="submit">Register & Generate QR</button>
        </form>

        {newProviderQR && (
          <div className="qr-card">
            <h3>Provider QR generated</h3>
            <p>{newProviderQR.full_name}</p>
            <QRCodeSVG
              id="provider-qr-svg"
              value={newProviderQR.qr_token}
              size={220}
              includeMargin
            />
            <button
              onClick={() =>
                downloadQR(
                  "provider-qr-svg",
                  `GatePass-${newProviderQR.full_name}.svg`
                )
              }
            >
              Download QR
            </button>
          </div>
        )}

        <h2>Service Providers</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Flat</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((person) => (
                <tr key={person.id}>
                  <td>{person.full_name}</td>
                  <td>{person.category}</td>
                  <td>{person.flat_number || person.flat_id}</td>
                  <td>{person.active ? "Active" : "Inactive"}</td>
                  <td>
                    {person.active && (
                      <button
                        onClick={() => handleDeactivateProvider(person.id)}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderVisitors() {
    return (
      <section className="panel">
        <h2>Register Visitor</h2>

        <form onSubmit={handleCreateVisitor} className="form-grid">
          <input
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            placeholder="Visitor full name"
            required
          />

          <input
            value={visitorPhone}
            onChange={(e) => setVisitorPhone(e.target.value)}
            placeholder="Contact number"
            required
          />

          <input
            value={visitorPurpose}
            onChange={(e) => setVisitorPurpose(e.target.value)}
            placeholder="Purpose of visit"
            required
          />

          <select
            value={visitorFlat}
            onChange={(e) => setVisitorFlat(e.target.value)}
            required
          >
            <option value="">Select flat</option>
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>
                {flatLabel(flat)}
              </option>
            ))}
          </select>

          <button type="submit">Register Visitor / Check In</button>
        </form>

        <h2>Visitor Records</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Flat</th>
                <th>Purpose</th>
                <th>Entry</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>{visitor.full_name}</td>
                  <td>{visitor.flat_number || visitor.flat_id}</td>
                  <td>{visitor.purpose}</td>
                  <td>
                    {new Date(visitor.created_at).toLocaleString()}
                  </td>
                  <td>{visitor.status}</td>
                  <td>
                    {visitor.status === "Inside" && (
                      <button
                        onClick={() => handleVisitorCheckout(visitor.id)}
                      >
                        Check Out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderAccessLogs() {
    const filtered = movements.filter((movement) => {
      const search = logSearch.toLowerCase();

      return (
        movement.full_name?.toLowerCase().includes(search) ||
        movement.flat_number?.toLowerCase().includes(search) ||
        movement.action.toLowerCase().includes(search)
      );
    });

    return (
      <section className="panel">
        <h2>Resident Access Logs</h2>

        <input
          value={logSearch}
          onChange={(e) => setLogSearch(e.target.value)}
          placeholder="Search resident, flat or action"
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resident</th>
                <th>Flat</th>
                <th>Action</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.full_name}</td>
                  <td>{movement.flat_number || movement.flat_id}</td>
                  <td>{movement.action}</td>
                  <td>
                    {new Date(movement.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Residents Currently Inside / Outside</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resident</th>
                <th>Flat</th>
                <th>Current Status</th>
                <th>Last Movement</th>
              </tr>
            </thead>
            <tbody>
              {currentStatuses.map((status) => (
                <tr key={status.resident_id}>
                  <td>{status.full_name}</td>
                  <td>{status.flat_number}</td>
                  <td>{status.status}</td>
                  <td>
                    {status.created_at
                      ? new Date(status.created_at).toLocaleString()
                      : "No movement recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderDashboard() {
    const insideVisitors = visitors.filter(
      (visitor) => visitor.status === "Inside"
    ).length;

    const insideResidents = currentStatuses.filter(
      (resident) => resident.status === "Inside"
    ).length;

    return (
      <>
        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Flats</span>
            <h2>{flats.length}</h2>
          </div>
          <div className="stat-card">
            <span>Residents</span>
            <h2>{residents.length}</h2>
          </div>
          <div className="stat-card">
            <span>Service Providers</span>
            <h2>{providers.filter((p) => p.active).length}</h2>
          </div>
          <div className="stat-card">
            <span>Visitors Inside</span>
            <h2>{insideVisitors}</h2>
          </div>
          <div className="stat-card">
            <span>Residents Inside</span>
            <h2>{insideResidents}</h2>
          </div>
        </div>

        <section className="panel">
          <h2>Gate Operations</h2>
          <p>
            Scan a flat QR to record a resident's entry or exit. Scan a
            service-provider QR to verify the provider.
          </p>
          <button onClick={() => setScannerOpen(true)}>
            Open QR Scanner
          </button>
        </section>

        {renderFlats()}
      </>
    );
  }

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return renderDashboard();
      case "Residents":
        return renderResidents();
      case "Service Providers":
        return renderProviders();
      case "Visitors":
        return renderVisitors();
      case "Access Logs":
        return renderAccessLogs();
      case "Settings":
        return (
          <section className="panel">
            <h2>Settings</h2>
            <p>Settings and configuration options will be added here.</p>
          </section>
        );
      default:
        return renderDashboard();
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="brand">GatePass</h2>
        <p className="sidebar-subtitle">Visitor Management</p>

        <nav>
          {(
            [
              "Dashboard",
              "Residents",
              "Service Providers",
              "Visitors",
              "Access Logs",
              "Settings",
            ] as Page[]
          ).map((page) => (
            <button
              key={page}
              className={activePage === page ? "active" : ""}
              onClick={() => setActivePage(page)}
            >
              {page}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
            <p>GatePass Society Management System</p>
          </div>

          <button onClick={() => setScannerOpen(true)}>
            Scan QR
          </button>
        </header>

        {message && (
          <div className="app-message">
            <span>{message}</span>
            <button onClick={() => setMessage("")}>Dismiss</button>
          </div>
        )}

        {loading && <p>Loading data...</p>}

        {renderPage()}
      </main>

      {scannerOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Gate QR Scanner</h2>
              <button onClick={closeScanner}>Close</button>
            </div>

            {!scanResult && (
              <>
                <p>
                  Scan a flat QR or an active service-provider QR.
                </p>
                <div id="gatepass-qr-reader" />
              </>
            )}

            {scanning && <p>Validating QR...</p>}

            {scanMessage && <p>{scanMessage}</p>}

            {scanResult?.type === "flat" && (
              <div className="scan-result">
                <h3>
                  Flat {scanResult.flat.flat_number}
                  {scanResult.flat.building
                    ? ` · ${scanResult.flat.building}`
                    : ""}
                </h3>

                {scanResult.residents.length === 0 ? (
                  <p>No residents are registered under this flat.</p>
                ) : (
                  <>
                    <label htmlFor="resident-select">
                      Select resident
                    </label>

                    <select
                      id="resident-select"
                      value={selectedResidentId}
                      onChange={(e) =>
                        setSelectedResidentId(e.target.value)
                      }
                    >
                      <option value="">Choose resident</option>
                      {scanResult.residents.map((resident) => (
                        <option key={resident.id} value={resident.id}>
                          {resident.full_name} —{" "}
                          {residentStatus(resident.id)}
                        </option>
                      ))}
                    </select>

                    {selectedResidentId && (
                      <div className="movement-actions">
                        <p>
                          Current status:{" "}
                          <strong>
                            {residentStatus(Number(selectedResidentId))}
                          </strong>
                        </p>

                        {residentStatus(Number(selectedResidentId)) ===
                          "Inside" ? (
                          <button
                            onClick={() =>
                              handleResidentMovement("Check Out")
                            }
                          >
                            Record Check Out
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleResidentMovement("Check In")
                            }
                          >
                            Record Check In
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {scanResult?.type === "secondary" && (
              <div className="scan-result">
                <h3>Service Provider Verified</h3>
                <p>
                  <strong>Name:</strong>{" "}
                  {scanResult.person.full_name}
                </p>
                <p>
                  <strong>Category:</strong>{" "}
                  {scanResult.person.category}
                </p>
                <p>
                  <strong>Flat:</strong>{" "}
                  {scanResult.person.flat_number}
                </p>
                <p>
                  <strong>Linked Resident:</strong>{" "}
                  {scanResult.person.primary_resident || "Not specified"}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {scanResult.person.active ? "Active" : "Inactive"}
                </p>
                <p>
                  This QR has been verified. Provider movement logging is
                  not yet included in this workflow.
                </p>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={closeScanner}>Close Scanner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
