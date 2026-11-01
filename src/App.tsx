
import { useCallback, useEffect, useState } from "react";
import {
  getVisitorAccessLogs,
  type VisitorAccessLog,
  getFlats,
  createFlat,
  getResidents,
  createResident,
  getVisitors,
  createVisitor,
  checkoutVisitor,
  deactivateResident,
  reactivateResident,
  archiveVisitor,
  restoreVisitor,
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
  type FlatQRCreated,
  type QRValidationResult,
  type ResidentMovement,
  type CurrentResidentStatus,
  type MovementAction,
} from "./api";

import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";

import {
  LayoutDashboard,
  Users,
  UserRoundCog,
  ClipboardList,
  ShieldCheck,
  Settings,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Car,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Residents", icon: Users },
  { label: "Service Providers", icon: UserRoundCog },
  { label: "Visitors", icon: ClipboardList },
  { label: "Access Logs", icon: ShieldCheck },
  { label: "Settings", icon: Settings },
];

type Page =
  | "Dashboard"
  | "Residents"
  | "Service Providers"
  | "Visitors"
  | "Access Logs"
  | "Settings";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [visitorFlatId, setVisitorFlatId] = useState("");
  const [visitorSubmitting, setVisitorSubmitting] = useState(false);

  const [flats, setFlats] = useState<Flat[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(true);
  const [flatsError, setFlatsError] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [building, setBuilding] = useState("");
  const [flatMessage, setFlatMessage] = useState("");

  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(true);
  const [residentsError, setResidentsError] = useState("");
  const [residentName, setResidentName] = useState("");
  const [residentFlatId, setResidentFlatId] = useState("");
  const [residentPhone, setResidentPhone] = useState("");
  const [residentMessage, setResidentMessage] = useState("");

  const [residentView, setResidentView] = useState<"active" | "inactive">("active");
  const [residentManagementActionId, setResidentManagementActionId] =
    useState<number | null>(null);

  const [visitorAccessLogs, setVisitorAccessLogs] = useState<VisitorAccessLog[]>([]);
  const [visitorLogsLoading, setVisitorLogsLoading] = useState(false);
  const [visitorLogsError, setVisitorLogsError] = useState("");

  const [secondaryPeople, setSecondaryPeople] = useState<SecondaryPerson[]>([]);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [secondaryError, setSecondaryError] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [secondaryCategory, setSecondaryCategory] = useState("Maid");
  const [secondaryResidentId, setSecondaryResidentId] = useState("");
  const [secondaryFlatId, setSecondaryFlatId] = useState("");
  const [secondaryMessage, setSecondaryMessage] = useState("");
  const [newProviderQR, setNewProviderQR] = useState("");

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsError, setVisitorsError] = useState("");
  const [visitorActionId, setVisitorActionId] = useState<number | null>(null);
  const [visitorView, setVisitorView] = useState<"active" | "archived">("active");

  const [flatQR, setFlatQR] = useState<FlatQRCreated | null>(null);
  const [flatQRLoading, setFlatQRLoading] = useState<number | null>(null);
  const [flatQRMessage, setFlatQRMessage] = useState("");

  const [movements, setMovements] = useState<ResidentMovement[]>([]);
  const [currentStatuses, setCurrentStatuses] = useState<CurrentResidentStatus[]>([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [movementSearch, setMovementSearch] = useState("");

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanResult, setQrScanResult] = useState<QRValidationResult | null>(null);
  const [qrScanMessage, setQrScanMessage] = useState("");
  const [qrScanBusy, setQrScanBusy] = useState(false);
  const [selectedMovementResident, setSelectedMovementResident] = useState("");
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [residentActionId, setResidentActionId] = useState<number | null>(null);

  // ---------------- DATA LOADERS ----------------

  const loadVisitorAccessLogs = useCallback(async () => {
    setVisitorLogsLoading(true);

    try {
      const data = await getVisitorAccessLogs();
      setVisitorAccessLogs(data);
      setVisitorLogsError("");
    } catch (error) {
      console.error("Failed to load visitor access logs:", error);
      setVisitorLogsError(
        error instanceof Error
          ? error.message
          : "Could not load visitor access logs."
      );
    } finally {
      setVisitorLogsLoading(false);
    }
  }, []);

  const loadVisitors = useCallback(async () => {
    try {
      setVisitors(await getVisitors());
      setVisitorsError("");
    } catch (error) {
      console.error("Failed to load visitors:", error);
      setVisitorsError(
        error instanceof Error ? error.message : "Could not load visitors."
      );
    } finally {
      setVisitorsLoading(false);
    }
  }, []);

  const loadSecondaryPeople = useCallback(async () => {
    try {
      setSecondaryPeople(await getSecondaryPeople());
      setSecondaryError("");
    } catch (error) {
      console.error("Failed to load service providers:", error);
      setSecondaryError(
        error instanceof Error ? error.message : "Could not load service providers."
      );
    } finally {
      setSecondaryLoading(false);
    }
  }, []);

  const loadResidentMovements = useCallback(async () => {
    setMovementLoading(true);

    try {
      const [movementData, statusData] = await Promise.all([
        getResidentMovements(),
        getCurrentResidentStatus(),
      ]);

      setMovements(movementData);
      setCurrentStatuses(statusData);
      setMovementError("");
    } catch (error) {
      console.error("Failed to load resident movements:", error);
      setMovementError(
        error instanceof Error ? error.message : "Could not load resident movements."
      );
    } finally {
      setMovementLoading(false);
    }
  }, []);

  const loadFlats = useCallback(async () => {
    try {
      setFlats(await getFlats());
      setFlatsError("");
    } catch (error) {
      console.error("Failed to load flats:", error);
      setFlatsError(
        error instanceof Error ? error.message : "Could not load flats."
      );
    } finally {
      setFlatsLoading(false);
    }
  }, []);

  const loadResidents = useCallback(async () => {
    try {
      setResidents(await getResidents());
      setResidentsError("");
    } catch (error) {
      console.error("Failed to load residents:", error);
      setResidentsError(
        error instanceof Error ? error.message : "Could not load residents."
      );
    } finally {
      setResidentsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadFlats(),
      loadResidents(),
      loadVisitors(),
      loadSecondaryPeople(),
      loadResidentMovements(),
      loadVisitorAccessLogs(),
    ]);
  }, [
    loadFlats,
    loadResidents,
    loadVisitors,
    loadSecondaryPeople,
    loadResidentMovements,
    loadVisitorAccessLogs,
  ]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // ---------------- QR SCANNER ----------------

  useEffect(() => {
    if (!showQRScanner) return;

    let scanner: Html5QrcodeScanner | null = null;
    let handled = false;

    const timer = window.setTimeout(() => {
      const reader = document.getElementById("gatepass-qr-reader");
      if (!reader) return;

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
        async (decodedText: string) => {
          if (handled) return;

          handled = true;
          setQrScanBusy(true);
          setQrScanMessage("");
          setQrScanResult(null);
          setSelectedMovementResident("");

          try {
            const result = await validateQR(decodedText);

            setQrScanResult(result);

            if (result.type === "flat") {
              setQrScanMessage(
                `Flat ${result.flat.flat_number} verified. Select the resident.`
              );
            } else {
              setQrScanMessage(
                `Service provider verified: ${result.person.full_name}`
              );
            }

            await scanner?.clear();
          } catch (error) {
            handled = false;
            setQrScanMessage(
              error instanceof Error ? error.message : "QR verification failed."
            );
          } finally {
            setQrScanBusy(false);
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
        void scanner.clear().catch(() => undefined);
      }
    };
  }, [showQRScanner]);

  function closeQRScanner() {
    setShowQRScanner(false);
    setQrScanResult(null);
    setQrScanMessage("");
    setSelectedMovementResident("");
    setQrScanBusy(false);
    setMovementSubmitting(false);
  }

  // ---------------- FLATS ----------------

  async function handleCreateFlat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFlatMessage("Registering flat...");

    try {
      const created = await createFlat({
        flat_number: flatNumber.trim(),
        building: building.trim() || undefined,
      });

      setFlats((current) => [...current, created]);
      setFlatNumber("");
      setBuilding("");
      setFlatMessage("Flat registered successfully.");
      setFlatsError("");
    } catch (error) {
      setFlatMessage(
        error instanceof Error ? error.message : "Could not register flat."
      );
    }
  }

  async function handleGenerateFlatQR(flat: Flat) {
    const confirmed = window.confirm(
      `Generate a new QR for flat ${flat.flat_number}?\n\n` +
        "The previously generated QR for this flat will stop working."
    );

    if (!confirmed) return;

    setFlatQRLoading(flat.id);
    setFlatQR(null);
    setFlatQRMessage("Generating flat QR...");

    try {
      const result = await generateFlatQR(flat.id);
      setFlatQR(result);
      setFlatQRMessage(`QR generated successfully for ${flat.flat_number}.`);
    } catch (error) {
      setFlatQRMessage(
        error instanceof Error ? error.message : "Could not generate flat QR."
      );
    } finally {
      setFlatQRLoading(null);
    }
  }

  // ---------------- RESIDENTS ----------------

  async function handleCreateResident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!residentFlatId) {
      setResidentMessage("Please select a flat.");
      return;
    }

    setResidentMessage("Registering resident...");

    try {
      const created = await createResident({
        full_name: residentName.trim(),
        flat_id: Number(residentFlatId),
        phone: residentPhone.trim(),
      });

      setResidents((current) => [...current, created]);
      setResidentName("");
      setResidentFlatId("");
      setResidentPhone("");
      setResidentMessage("Resident registered successfully.");
      setResidentsError("");
    } catch (error) {
      setResidentMessage(
        error instanceof Error ? error.message : "Could not register resident."
      );
    }
  }

  async function handleResidentStatusChange(resident: Resident) {
    if (residentManagementActionId !== null) return;

    const action = resident.is_active ? "deactivate" : "reactivate";

    const confirmed = window.confirm(
      `${action === "deactivate" ? "Deactivate" : "Reactivate"} ${resident.full_name}?\n\n` +
        (action === "deactivate"
          ? "Their historical movement records will be preserved. They will no longer be available for new movement entries."
          : "They will become active again.")
    );

    if (!confirmed) return;

    setResidentManagementActionId(resident.id);
    setResidentsError("");

    try {
      if (action === "deactivate") {
        await deactivateResident(resident.id);
      } else {
        await reactivateResident(resident.id);
      }

      await Promise.all([
        loadResidents(),
        loadResidentMovements(),
      ]);

      setResidentMessage(
        `${resident.full_name} ${
          action === "deactivate" ? "deactivated" : "reactivated"
        } successfully.`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : `Could not ${action} resident.`
      );
    } finally {
      setResidentManagementActionId(null);
    }
  }

  // ---------------- VISITORS ----------------

  async function handleRegisterVisitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (visitorSubmitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const fullName = String(data.get("visitorName") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const purpose = String(data.get("purpose") ?? "").trim();
    const flatId = Number(visitorFlatId);

    if (!fullName || !phone || !purpose || !Number.isInteger(flatId)) {
      alert("Please complete all visitor details.");
      return;
    }

    if (!flats.some((flat) => flat.id === flatId)) {
      alert("Please select a valid registered flat.");
      return;
    }

    setVisitorSubmitting(true);

    try {
      await createVisitor({
        full_name: fullName,
        flat_id: flatId,
        phone,
        purpose,
      });

      await loadVisitors();

      form.reset();
      setVisitorFlatId("");
      setShowVisitorForm(false);
      setActivePage("Visitors");
      setVisitorView("active");

      alert("Visitor registered successfully!");
    } catch (error) {
      console.error("Visitor registration failed:", error);
      alert(
        error instanceof Error
          ? `Registration failed: ${error.message}`
          : "Visitor registration failed. Please try again."
      );
    } finally {
      setVisitorSubmitting(false);
    }
  }

  async function handleCheckout(visitor: Visitor) {
    if (visitorActionId !== null) return;

    if (!window.confirm(`Check out ${visitor.full_name}?`)) return;

    setVisitorActionId(visitor.id);

    try {
      await checkoutVisitor(visitor.id);
      await Promise.all([
        loadVisitors(),
        loadVisitorAccessLogs(),
      ]);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not check out visitor."
      );
    } finally {
      setVisitorActionId(null);
    }
  }

  async function handleVisitorArchiveChange(visitor: Visitor) {
    if (visitorActionId !== null) return;

    const action = visitor.is_archived ? "restore" : "archive";

    const confirmed = window.confirm(
      `${action === "archive" ? "Archive" : "Restore"} ${visitor.full_name}?\n\n` +
        (action === "archive"
          ? "The visitor record will be hidden from active visitor records. Access logs will be preserved."
          : "The visitor record will return to the active visitor list.")
    );

    if (!confirmed) return;

    setVisitorActionId(visitor.id);

    try {
      if (action === "archive") {
        await archiveVisitor(visitor.id);
      } else {
        await restoreVisitor(visitor.id);
      }

      await Promise.all([
        loadVisitors(),
        loadVisitorAccessLogs(),
      ]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : `Could not ${action} visitor.`
      );
    } finally {
      setVisitorActionId(null);
    }
  }

  // ---------------- SERVICE PROVIDERS ----------------

  async function handleCreateSecondaryPerson(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const resident = residents.find(
      (item) => item.id === Number(secondaryResidentId)
    );

    const flatId = Number(secondaryFlatId);

    if (!Number.isInteger(flatId) || !flats.some((flat) => flat.id === flatId)) {
      setSecondaryMessage("Please select a valid flat.");
      return;
    }

    if (secondaryResidentId && (!resident || resident.flat_id !== flatId)) {
      setSecondaryMessage("Select a resident belonging to the selected flat.");
      return;
    }

    if (resident && !resident.is_active) {
      setSecondaryMessage("Select an active resident.");
      return;
    }

    setSecondaryMessage("Registering service provider...");

    try {
      const created = await createSecondaryPerson({
        full_name: secondaryName.trim(),
        phone: secondaryPhone.trim(),
        category: secondaryCategory,
        flat_id: flatId,
        resident_id: resident ? resident.id : null,
      });

      setSecondaryPeople((current) => [...current, created]);
      setNewProviderQR(created.qr_token);
      setSecondaryName("");
      setSecondaryPhone("");
      setSecondaryResidentId("");
      setSecondaryFlatId("");
      setSecondaryCategory("Maid");
      setSecondaryMessage("Service provider registered successfully!");
    } catch (error) {
      console.error("Service provider registration failed:", error);
      setSecondaryMessage(
        error instanceof Error
          ? error.message
          : "Could not register service provider."
      );
    }
  }

  async function handleDeactivateSecondaryPerson(personId: number) {
    if (!window.confirm("Deactivate this service provider?")) return;

    try {
      await deactivateSecondaryPerson(personId);
      await loadSecondaryPeople();
      setSecondaryMessage("Service provider deactivated.");
    } catch (error) {
      console.error("Service provider deactivation failed:", error);
      setSecondaryMessage(
        error instanceof Error
          ? error.message
          : "Could not deactivate service provider."
      );
    }
  }

  // ---------------- RESIDENT MOVEMENTS ----------------

  function residentStatus(residentId: number) {
    return (
      currentStatuses.find((item) => item.resident_id === residentId)?.status ??
      "Unknown"
    );
  }

  async function handleResidentMovement(action: MovementAction) {
    if (!selectedMovementResident || movementSubmitting) return;

    setMovementSubmitting(true);
    setQrScanMessage("Recording movement...");

    try {
      await recordResidentMovement(Number(selectedMovementResident), action);

      setQrScanMessage(`${action} recorded successfully.`);

      await loadResidentMovements();

      window.setTimeout(() => {
        closeQRScanner();
      }, 1200);
    } catch (error) {
      setQrScanMessage(
        error instanceof Error ? error.message : "Could not record movement."
      );
    } finally {
      setMovementSubmitting(false);
    }
  }

  async function handleResidentMovementDirect(
    resident: Resident,
    action: MovementAction
  ) {
    if (residentActionId !== null) return;

    const confirmed = window.confirm(
      `${action} ${resident.full_name}?`
    );

    if (!confirmed) return;

    setResidentActionId(resident.id);
    setMovementError("");

    try {
      await recordResidentMovement(resident.id, action);
      await loadResidentMovements();
      alert(`${resident.full_name}: ${action} recorded successfully.`);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not record resident movement."
      );
    } finally {
      setResidentActionId(null);
    }
  }

  // ---------------- QR DOWNLOAD ----------------

  function downloadQRCode(elementId: string, filename: string) {
    const svg = document.getElementById(elementId);

    if (!(svg instanceof SVGElement)) {
      alert("QR code could not be found.");
      return;
    }

    const source = new XMLSerializer().serializeToString(svg);
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
    return `${flat.flat_number}${flat.building ? ` — ${flat.building}` : ""}`;
  }

  const today = new Date().toDateString();

  const activeVisitors = visitors.filter((v) => !v.is_archived);

  const stats = [
    {
      label: "Total Visitors",
      value: String(activeVisitors.length),
      icon: Users,
      color: "blue",
      change: "Active visitor records",
    },
    {
      label: "Currently Inside",
      value: String(activeVisitors.filter((v) => v.status === "Inside").length),
      icon: ShieldCheck,
      color: "green",
      change: "Visitors currently on premises",
    },
    {
      label: "Today's Visitors",
      value: String(
        activeVisitors.filter(
          (v) => new Date(v.created_at).toDateString() === today
        ).length
      ),
      icon: Clock,
      color: "orange",
      change: "Registered today",
    },
    {
      label: "Registered Flats",
      value: String(flats.length),
      icon: LayoutDashboard,
      color: "purple",
      change: "Flats in database",
    },
  ];

  const filteredVisitors = visitors.filter((visitor) => {
    const matchesView =
      visitorView === "active"
        ? !visitor.is_archived
        : visitor.is_archived;

    const matchesSearch = [
      visitor.full_name,
      visitor.flat_number ?? "",
      visitor.building ?? "",
      visitor.purpose,
      visitor.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesView && matchesSearch;
  });

  // ---------------- VISITOR TABLE ----------------

  function renderVisitorsTable() {
    return (
      <article className="panel visitor-panel">
        <div className="panel-heading">
          <div>
            <h3>
              {activePage === "Dashboard" ? "Recent Visitors" : "Visitor Records"}
            </h3>
            <p>Visitor activity retrieved from the GatePass database</p>
          </div>
          <span className="live-tag">DATABASE</span>
        </div>

        <div style={{ display: "flex", gap: 10, margin: "20px 0", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setVisitorView("active")}
            disabled={visitorView === "active"}
          >
            Active Visitors ({visitors.filter((v) => !v.is_archived).length})
          </button>

          <button
            type="button"
            onClick={() => setVisitorView("archived")}
            disabled={visitorView === "archived"}
          >
            Archived Visitors ({visitors.filter((v) => v.is_archived).length})
          </button>
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search visitors or flats..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className="records-label">
            {filteredVisitors.length} records
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>VISITOR</th>
                <th>DESTINATION</th>
                <th>PURPOSE</th>
                <th>ARRIVAL</th>
                <th>STATUS / ACTION</th>
              </tr>
            </thead>

            <tbody>
              {visitorsLoading && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Loading visitors...
                  </td>
                </tr>
              )}

              {!visitorsLoading && visitorsError && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {visitorsError}{" "}
                    <button type="button" onClick={() => void loadVisitors()}>
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {!visitorsLoading &&
                !visitorsError &&
                filteredVisitors.map((visitor) => (
                  <tr key={visitor.id}>
                    <td>
                      <div className="visitor-person">
                        <div className="avatar visitor-avatar">
                          {visitor.full_name
                            .split(/\s+/)
                            .map((part) => part[0] ?? "")
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span>{visitor.full_name}</span>
                      </div>
                    </td>

                    <td className="flat-number">
                      {visitor.building
                        ? `${visitor.building} - ${visitor.flat_number}`
                        : visitor.flat_number}
                    </td>

                    <td>{visitor.purpose}</td>

                    <td>
                      {new Date(visitor.created_at).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          visitor.is_archived
                            ? "badge-gray"
                            : visitor.status === "Inside"
                              ? "badge-green"
                              : "badge-gray"
                        }`}
                      >
                        <span className="badge-dot" />
                        {visitor.is_archived ? "Archived" : visitor.status}
                      </span>

                      {!visitor.is_archived && visitor.status === "Inside" && (
                        <button
                          type="button"
                          disabled={visitorActionId !== null}
                          onClick={() => void handleCheckout(visitor)}
                        >
                          {visitorActionId === visitor.id
                            ? "Processing..."
                            : "Check Out"}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={visitorActionId !== null}
                        onClick={() => void handleVisitorArchiveChange(visitor)}
                      >
                        {visitorActionId === visitor.id
                          ? "Updating..."
                          : visitor.is_archived
                            ? "Restore"
                            : "Archive"}
                      </button>
                    </td>
                  </tr>
                ))}

              {!visitorsLoading &&
                !visitorsError &&
                filteredVisitors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No {visitorView} visitors found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="panel-footer">
          {filteredVisitors.length} {visitorView} visitor records · Live database
        </div>
      </article>
    );
  }

  // ---------------- FLATS PAGE ----------------

  function renderFlats() {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <div className="panel-heading">
          <div>
            <h3>Registered Flats</h3>
            <p>Manage flats stored in the GatePass database</p>
          </div>
          <span className="live-tag">DATABASE</span>
        </div>

        <form
          onSubmit={handleCreateFlat}
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <input
            value={flatNumber}
            onChange={(event) => setFlatNumber(event.target.value)}
            placeholder="Flat number (e.g. A-101)"
            required
            maxLength={30}
          />

          <input
            value={building}
            onChange={(event) => setBuilding(event.target.value)}
            placeholder="Building / tower (optional)"
            maxLength={60}
          />

          <button type="submit">Register Flat</button>
        </form>

        {flatMessage && <p role="status">{flatMessage}</p>}
        {flatsLoading && <p>Loading flats...</p>}
        {flatsError && <p>{flatsError}</p>}

        {!flatsLoading && !flatsError && flats.length === 0 && (
          <p>No flats registered yet.</p>
        )}

        {!flatsLoading &&
          !flatsError &&
          flats.map((flat) => (
            <div
              key={flat.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>{flat.flat_number}</strong>
                {flat.building && <span> — {flat.building}</span>}
              </div>

              <button
                type="button"
                disabled={flatQRLoading === flat.id}
                onClick={() => void handleGenerateFlatQR(flat)}
              >
                {flatQRLoading === flat.id
                  ? "Generating..."
                  : "Generate Flat QR"}
              </button>
            </div>
          ))}

        {flatQRMessage && (
          <p role="status" style={{ marginTop: 12 }}>
            {flatQRMessage}
          </p>
        )}

        {flatQR && (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              maxWidth: "100%",
            }}
          >
            <h3>Flat QR Code</h3>

            <strong>
              {flatQR.flat.flat_number}
              {flatQR.flat.building ? ` — ${flatQR.flat.building}` : ""}
            </strong>

            <QRCodeSVG
              id="flat-qr-svg"
              value={flatQR.qr_token}
              size={220}
              level="H"
              includeMargin
            />

            <button
              type="button"
              onClick={() =>
                downloadQRCode(
                  "flat-qr-svg",
                  `GatePass-${flatQR.flat.flat_number}.svg`
                )
              }
            >
              Download Flat QR
            </button>

            <small>
              One QR is shared by the flat. The guard selects the resident
              after scanning.
            </small>

            <small style={{ color: "#b45309" }}>
              Generating another QR invalidates the previous QR.
            </small>
          </div>
        )}
      </section>
    );
  }

  // ---------------- RESIDENTS PAGE ----------------

  function renderResidents() {
    const displayedResidents = residents.filter((resident) =>
      residentView === "active" ? resident.is_active : !resident.is_active
    );

    return (
      <>
        {renderFlats()}

        <section
          className="panel"
          id="resident-management"
          style={{ padding: 24, marginTop: 24 }}
        >
          <div className="panel-heading">
            <div>
              <h3>Resident Management</h3>
              <p>Register residents and manage their entry and exit</p>
            </div>
            <span className="live-tag">DATABASE</span>
          </div>

          <form
            onSubmit={handleCreateResident}
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <input
              value={residentName}
              onChange={(event) => setResidentName(event.target.value)}
              placeholder="Resident full name"
              required
              maxLength={100}
            />

            <select
              value={residentFlatId}
              onChange={(event) => setResidentFlatId(event.target.value)}
              required
            >
              <option value="">Select flat</option>
              {flats.map((flat) => (
                <option key={flat.id} value={flat.id}>
                  {flatLabel(flat)}
                </option>
              ))}
            </select>

            <input
              value={residentPhone}
              onChange={(event) => setResidentPhone(event.target.value)}
              placeholder="Phone number"
              required
              maxLength={20}
            />

            <button type="submit" disabled={flats.length === 0}>
              Register Resident
            </button>
          </form>

          {flats.length === 0 && !flatsLoading && (
            <p>Register a flat first before adding residents.</p>
          )}

          {residentMessage && <p role="status">{residentMessage}</p>}
          {residentsLoading && <p>Loading residents...</p>}
          {residentsError && <p role="alert">{residentsError}</p>}

          <div
            style={{
              display: "flex",
              gap: 10,
              margin: "20px 0",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setResidentView("active")}
              disabled={residentView === "active"}
            >
              Active Residents ({residents.filter((r) => r.is_active).length})
            </button>

            <button
              type="button"
              onClick={() => setResidentView("inactive")}
              disabled={residentView === "inactive"}
            >
              Inactive Residents ({residents.filter((r) => !r.is_active).length})
            </button>
          </div>

          {!residentsLoading &&
            !residentsError &&
            displayedResidents.map((resident) => {
              const status = residentStatus(resident.id);
              const isProcessing =
                residentManagementActionId === resident.id;
              const isMovementProcessing = residentActionId === resident.id;

              return (
                <div
                  key={resident.id}
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{resident.full_name}</strong>

                    <div>
                      Flat {resident.flat_number ?? resident.flat_id}
                      {resident.building ? ` — ${resident.building}` : ""}
                    </div>

                    {resident.phone && <div>{resident.phone}</div>}

                    <span
                      className={`badge ${
                        !resident.is_active
                          ? "badge-gray"
                          : status === "Inside"
                            ? "badge-green"
                            : "badge-gray"
                      }`}
                    >
                      <span className="badge-dot" />
                      {!resident.is_active ? "Inactive" : status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {!resident.is_active ? (
                      <span className="badge badge-gray">Inactive</span>
                    ) : status === "Inside" ? (
                      <button
                        type="button"
                        disabled={
                          isMovementProcessing || residentActionId !== null
                        }
                        onClick={() =>
                          void handleResidentMovementDirect(
                            resident,
                            "Check Out"
                          )
                        }
                      >
                        {isMovementProcessing ? "Recording..." : "Check Out"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          isMovementProcessing || residentActionId !== null
                        }
                        onClick={() =>
                          void handleResidentMovementDirect(
                            resident,
                            "Check In"
                          )
                        }
                      >
                        {isMovementProcessing ? "Recording..." : "Check In"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={residentManagementActionId !== null}
                      onClick={() =>
                        void handleResidentStatusChange(resident)
                      }
                    >
                      {isProcessing
                        ? "Updating..."
                        : resident.is_active
                          ? "Deactivate"
                          : "Reactivate"}
                    </button>
                  </div>
                </div>
              );
            })}

          {!residentsLoading &&
            !residentsError &&
            displayedResidents.length === 0 && (
              <p>No {residentView} residents found.</p>
            )}
        </section>
      </>
    );
  }

  // ---------------- SERVICE PROVIDERS PAGE ----------------

  function renderServiceProviders() {
    return (
      <section
        id="provider-management"
        className="panel"
        style={{ padding: 24 }}
      >
        <div className="panel-heading">
          <div>
            <h3>Service Provider Management</h3>
            <p>Register and manage recurring service providers.</p>
          </div>
          <span className="live-tag">DATABASE</span>
        </div>

        <form
          onSubmit={handleCreateSecondaryPerson}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 500,
            marginBottom: 24,
          }}
        >
          <input
            value={secondaryName}
            onChange={(event) => setSecondaryName(event.target.value)}
            placeholder="Full name"
            required
            maxLength={100}
          />

          <input
            value={secondaryPhone}
            onChange={(event) => setSecondaryPhone(event.target.value)}
            placeholder="Phone number"
            maxLength={20}
          />

          <select
            value={secondaryCategory}
            onChange={(event) => setSecondaryCategory(event.target.value)}
          >
            <option value="Maid">Maid</option>
            <option value="Milkman">Milkman</option>
            <option value="Vendor">Vendor</option>
            <option value="Driver">Driver</option>
            <option value="Cook">Cook</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={secondaryFlatId}
            onChange={(event) => {
              setSecondaryFlatId(event.target.value);
              setSecondaryResidentId("");
            }}
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
            value={secondaryResidentId}
            onChange={(event) => setSecondaryResidentId(event.target.value)}
          >
            <option value="">Select linked resident (optional)</option>
            {residents
              .filter(
                (resident) =>
                  resident.is_active &&
                  (!secondaryFlatId ||
                    resident.flat_id === Number(secondaryFlatId))
              )
              .map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.full_name}
                </option>
              ))}
          </select>

          <button type="submit" disabled={flats.length === 0}>
            Register Service Provider
          </button>
        </form>

        {secondaryMessage && <p role="status">{secondaryMessage}</p>}

        {newProviderQR && (
          <div
            style={{
              padding: 16,
              background: "#f0fdf4",
              marginBottom: 20,
              borderRadius: 10,
            }}
          >
            <strong>New provider QR code</strong>

            <div
              style={{
                background: "white",
                display: "inline-block",
                padding: 14,
                margin: "12px 0",
              }}
            >
              <QRCodeSVG
                id="provider-qr-svg"
                value={newProviderQR}
                size={220}
                level="H"
                includeMargin
              />
            </div>

            <button
              type="button"
              onClick={() =>
                downloadQRCode(
                  "provider-qr-svg",
                  "GatePass-Service-Provider.svg"
                )
              }
            >
              Download Provider QR
            </button>

            <p>
              <small>
                Save or print this QR code for the registered provider.
              </small>
            </p>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setQrScanMessage("");
              setQrScanResult(null);
              setShowQRScanner(true);
            }}
          >
            Scan Provider QR
          </button>
        </div>

        <h3>Registered Providers</h3>

        {secondaryLoading && <p>Loading providers...</p>}
        {secondaryError && <p>{secondaryError}</p>}

        {!secondaryLoading &&
          !secondaryError &&
          secondaryPeople.map((person) => (
            <div
              key={person.id}
              style={{
                padding: 14,
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <strong>{person.full_name}</strong>
                <p>
                  {person.category} · {person.flat_number ?? "Flat unavailable"}
                </p>
                <small>{person.active ? "Active" : "Inactive"}</small>
              </div>

              {person.active && (
                <button
                  type="button"
                  onClick={() =>
                    void handleDeactivateSecondaryPerson(person.id)
                  }
                >
                  Deactivate
                </button>
              )}
            </div>
          ))}

        {!secondaryLoading &&
          !secondaryError &&
          secondaryPeople.length === 0 && (
            <p>No service providers registered yet.</p>
          )}
      </section>
    );
  }

  // ---------------- ACCESS LOGS PAGE ----------------

  function renderAccessLogs() {
    const filteredMovements = movements.filter((movement) =>
      [
        movement.full_name ?? "",
        movement.flat_number ?? "",
        movement.building ?? "",
        movement.action,
      ]
        .join(" ")
        .toLowerCase()
        .includes(movementSearch.toLowerCase())
    );

    const filteredVisitorLogs = visitorAccessLogs.filter((log) =>
      [
        log.full_name,
        log.flat_number,
        log.building ?? "",
        log.phone,
        log.purpose,
        log.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(movementSearch.toLowerCase())
    );

    const refreshLogs = async () => {
      await Promise.all([
        loadResidentMovements(),
        loadVisitorAccessLogs(),
      ]);
    };

    const isRefreshing = movementLoading || visitorLogsLoading;

    return (
      <section className="panel" style={{ padding: 24 }}>
        <div className="panel-heading">
          <div>
            <h3>Resident Access Logs</h3>
            <p>Resident entry and exit history</p>
          </div>
          <span className="live-tag">DATABASE</span>
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search resident, flat or movement..."
              value={movementSearch}
              onChange={(event) => setMovementSearch(event.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => void refreshLogs()}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {movementError && (
          <p role="alert">
            {movementError}{" "}
            <button
              type="button"
              onClick={() => void loadResidentMovements()}
            >
              Retry
            </button>
          </p>
        )}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>RESIDENT</th>
                <th>FLAT</th>
                <th>MOVEMENT</th>
                <th>DATE & TIME</th>
              </tr>
            </thead>

            <tbody>
              {movementLoading && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    Loading movement history...
                  </td>
                </tr>
              )}

              {!movementLoading &&
                !movementError &&
                filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <div className="visitor-person">
                        <div className="avatar visitor-avatar">
                          {(movement.full_name ?? "R")
                            .split(/\s+/)
                            .map((part) => part[0] ?? "")
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span>
                          {movement.full_name ?? "Unknown resident"}
                        </span>
                      </div>
                    </td>

                    <td className="flat-number">
                      {movement.building
                        ? `${movement.building} - ${movement.flat_number}`
                        : movement.flat_number ?? movement.flat_id}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          movement.action === "Check In"
                            ? "badge-green"
                            : "badge-gray"
                        }`}
                      >
                        <span className="badge-dot" />
                        {movement.action}
                      </span>
                    </td>

                    <td>
                      {new Date(movement.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}

              {!movementLoading &&
                !movementError &&
                filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No resident movement records found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="panel-footer">
          {movements.length} resident movement records
        </div>

        {/* VISITOR ACCESS LOGS */}

        <div style={{ marginTop: 32 }}>
          <div className="panel-heading">
            <div>
              <h3>Visitor Access Logs</h3>
              <p>Visitor entry and exit history</p>
            </div>
            <span className="live-tag">DATABASE</span>
          </div>

          {visitorLogsError && (
            <p role="alert">
              {visitorLogsError}{" "}
              <button
                type="button"
                onClick={() => void loadVisitorAccessLogs()}
              >
                Retry
              </button>
            </p>
          )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>VISITOR</th>
                  <th>FLAT</th>
                  <th>PURPOSE</th>
                  <th>PHONE</th>
                  <th>ENTRY TIME</th>
                  <th>EXIT TIME</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {visitorLogsLoading && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Loading visitor logs...
                    </td>
                  </tr>
                )}

                {!visitorLogsLoading &&
                  !visitorLogsError &&
                  filteredVisitorLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="visitor-person">
                          <div className="avatar visitor-avatar">
                            {log.full_name
                              .split(/\s+/)
                              .map((part) => part[0] ?? "")
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span>{log.full_name}</span>
                        </div>
                      </td>

                      <td className="flat-number">
                        {log.building
                          ? `${log.building} - ${log.flat_number}`
                          : log.flat_number}
                      </td>

                      <td>{log.purpose}</td>
                      <td>{log.phone}</td>

                      <td>
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td>
                        {log.exited_at
                          ? new Date(log.exited_at).toLocaleString()
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            log.status === "Inside"
                              ? "badge-green"
                              : "badge-gray"
                          }`}
                        >
                          <span className="badge-dot" />
                          {log.status}
                        </span>
                        {log.is_archived && (
                          <small style={{ display: "block" }}>Archived</small>
                        )}
                      </td>
                    </tr>
                  ))}

                {!visitorLogsLoading &&
                  !visitorLogsError &&
                  filteredVisitorLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        No visitor access records found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          <div className="panel-footer">
            {visitorAccessLogs.length} visitor access records
          </div>
        </div>

        {/* CURRENT RESIDENT STATUS */}

        <div style={{ marginTop: 32 }}>
          <div className="panel-heading">
            <div>
              <h3>Current Resident Status</h3>
              <p>Latest recorded movement for each resident</p>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>RESIDENT</th>
                  <th>FLAT</th>
                  <th>CURRENT STATUS</th>
                  <th>LAST MOVEMENT</th>
                </tr>
              </thead>

              <tbody>
                {currentStatuses.map((resident) => (
                  <tr key={resident.resident_id}>
                    <td>{resident.full_name}</td>

                    <td>
                      {resident.building
                        ? `${resident.building} - ${resident.flat_number}`
                        : resident.flat_number}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          resident.status === "Inside"
                            ? "badge-green"
                            : "badge-gray"
                        }`}
                      >
                        <span className="badge-dot" />
                        {resident.status}
                      </span>
                    </td>

                    <td>
                      {resident.created_at
                        ? new Date(resident.created_at).toLocaleString()
                        : "No movement recorded"}
                    </td>
                  </tr>
                ))}

                {currentStatuses.length === 0 && !movementLoading && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No resident status data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ---------------- DASHBOARD ----------------

  function renderDashboard() {
    return (
      <>
        <section className="stats-grid">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <article className="stat-card" key={stat.label}>
                <div className="stat-top">
                  <div className={`stat-icon ${stat.color}`}>
                    <Icon size={21} />
                  </div>
                  <span className="stat-period">Live</span>
                </div>

                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>

                <div className="stat-footer">
                  <span>{stat.change}</span>
                  <ArrowUpRight size={16} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="overview-grid">
          {renderVisitorsTable()}

          <article className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <h3>Access Overview</h3>
                <p>Based on registered visitor and resident records</p>
              </div>
              <span className="live-tag">LIVE</span>
            </div>

            <div className="activity-metric">
              <div className="metric-icon entry-icon">
                <ArrowDownRight size={19} />
              </div>
              <div className="metric-details">
                <span>Visitors currently inside</span>
                <strong>
                  {activeVisitors.filter((v) => v.status === "Inside").length}
                </strong>
              </div>
            </div>

            <div className="activity-metric">
              <div className="metric-icon exit-icon">
                <ArrowUpRight size={19} />
              </div>
              <div className="metric-details">
                <span>Residents currently inside</span>
                <strong>
                  {currentStatuses.filter((r) => r.status === "Inside").length}
                </strong>
              </div>
            </div>

            <div className="security-note">
              <ShieldCheck size={19} />
              <div>
                <strong>Resident movement tracking</strong>
                <p>Entry and exit records are saved through the API.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="bottom-grid">
          <article className="panel quick-panel">
            <div className="panel-heading">
              <div>
                <h3>Quick Actions</h3>
                <p>Common management tasks</p>
              </div>
            </div>

            <div className="quick-actions">
              <button
                className="quick-action"
                onClick={() => setShowVisitorForm(true)}
              >
                <div className="quick-icon quick-blue">
                  <Plus size={20} />
                </div>
                <span>
                  <strong>Register Visitor</strong>
                  <small>Record a new arrival</small>
                </span>
                <ArrowUpRight size={17} />
              </button>

              <button
                className="quick-action"
                onClick={() => setActivePage("Residents")}
              >
                <div className="quick-icon quick-purple">
                  <Users size={20} />
                </div>
                <span>
                  <strong>Manage Residents</strong>
                  <small>Residents and flat records</small>
                </span>
                <ArrowUpRight size={17} />
              </button>

              <button
                className="quick-action"
                onClick={() => setActivePage("Access Logs")}
              >
                <div className="quick-icon quick-green">
                  <Clock size={20} />
                </div>
                <span>
                  <strong>View Access Logs</strong>
                  <small>Review entry and exit history</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </div>
          </article>

          <article className="panel vehicle-panel">
            <div className="panel-heading">
              <div>
                <h3>Gate Operations</h3>
                <p>QR-based gate management</p>
              </div>
              <Car size={20} />
            </div>

            <div className="gate-feature">
              <div className="gate-feature-icon">
                <ShieldCheck size={19} />
              </div>
              <div>
                <strong>Flat QR verification</strong>
                <p>Scan a flat QR and select the resident to record movement.</p>
              </div>
            </div>

            <div className="gate-feature">
              <div className="gate-feature-icon">
                <ClipboardList size={19} />
              </div>
              <div>
                <strong>Service provider verification</strong>
                <p>Verify active service-provider QR codes.</p>
              </div>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setQrScanMessage("");
                setQrScanResult(null);
                setShowQRScanner(true);
              }}
            >
              Open QR Scanner
            </button>
          </article>
        </section>

        <div style={{ marginTop: 24 }}>{renderFlats()}</div>
        <div style={{ marginTop: 24 }}>{renderResidents()}</div>
      </>
    );
  }

  // ---------------- PAGE CONTENT ----------------

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return renderDashboard();

      case "Residents":
        return renderResidents();

      case "Service Providers":
        return renderServiceProviders();

      case "Visitors":
        return renderVisitorsTable();

      case "Access Logs":
        return renderAccessLogs();

      case "Settings":
        return (
          <section className="panel placeholder-panel">
            <div className="placeholder-icon">
              <Settings size={27} />
            </div>
            <h3>Settings</h3>
            <p>
              Authentication, roles, and society settings are not implemented yet.
            </p>
            <span className="coming-soon">INTERFACE IN DEVELOPMENT</span>
          </section>
        );

      default:
        return renderDashboard();
    }
  }

  // ---------------- MAIN UI ----------------

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Close menu"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h1>GatePass</h1>
            <span>COMMUNITY MANAGEMENT</span>
          </div>

          <button
            className="icon-button mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const page = item.label as Page;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === page ? "nav-active" : ""
                }`}
                onClick={() => {
                  setActivePage(page);
                  setMobileMenu(false);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "Visitors" && (
                  <span className="nav-count">
                    {activeVisitors.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon">
              <ShieldCheck size={20} />
            </div>
            <strong>Security overview</strong>
            <p>Access monitoring dashboard</p>
            <div className="security-status">
              <span className="status-dot" />
              Development preview
            </div>
          </div>

          <div className="profile">
            <div className="avatar admin-avatar">AD</div>
            <div className="profile-info">
              <strong>Society Admin</strong>
              <span>Administrator</span>
            </div>
            <Settings size={18} className="profile-settings" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <div className="system-status">
              <span className="status-dot" />
              Preview mode
            </div>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() =>
                alert("Notifications have not been connected yet.")
              }
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            <div className="avatar top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">SOCIETY OPERATIONS</div>
              <h2>{activePage}</h2>
              <p className="page-description">
                {activePage === "Dashboard"
                  ? "Here's what's happening in your community today."
                  : `Manage your community's ${activePage.toLowerCase()} records.`}
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              style={{
                position: "relative",
                zIndex: 10,
                pointerEvents: "auto",
                cursor: "pointer",
              }}
              onClick={() => {
                if (
                  activePage === "Dashboard" ||
                  activePage === "Visitors"
                ) {
                  setShowVisitorForm(true);
                } else if (activePage === "Residents") {
                  document
                    .getElementById("resident-management")
                    ?.scrollIntoView({ behavior: "smooth" });
                } else if (activePage === "Service Providers") {
                  document
                    .getElementById("provider-management")
                    ?.scrollIntoView({ behavior: "smooth" });
                } else {
                  setShowQRScanner(true);
                }
              }}
            >
              <Plus size={18} />
              {activePage === "Dashboard" || activePage === "Visitors"
                ? "Register Visitor"
                : activePage === "Residents"
                  ? "Manage Residents"
                  : activePage === "Service Providers"
                    ? "Manage Providers"
                    : "Open QR Scanner"}
            </button>
          </div>

          {renderPage()}
        </div>
      </main>

      {/* QR SCANNER MODAL */}

      {showQRScanner && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeQRScanner();
          }}
        >
          <section className="visitor-modal" style={{ maxWidth: 520 }}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">GATE OPERATIONS</span>
                <h3>Gate QR Scanner</h3>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeQRScanner}
                aria-label="Close scanner"
              >
                <X size={20} />
              </button>
            </div>

            {!qrScanResult && (
              <>
                <p>Scan a flat QR or an active service-provider QR.</p>
                <div id="gatepass-qr-reader" />
              </>
            )}

            {qrScanBusy && <p>Verifying QR code...</p>}

            {qrScanMessage && (
              <p
                role="status"
                style={{
                  padding: 12,
                  background: "#f0fdf4",
                  borderRadius: 8,
                }}
              >
                {qrScanMessage}
              </p>
            )}

            {qrScanResult?.type === "flat" && (
              <div style={{ marginTop: 18 }}>
                <h3>
                  Flat {qrScanResult.flat.flat_number}
                  {qrScanResult.flat.building
                    ? ` — ${qrScanResult.flat.building}`
                    : ""}
                </h3>

                <p>
                  Select the resident whose movement you are recording.
                </p>

                {qrScanResult.residents.length === 0 ? (
                  <p>No active residents are registered under this flat.</p>
                ) : (
                  <>
                    <label htmlFor="movement-resident">
                      Resident
                    </label>

                    <select
                      id="movement-resident"
                      value={selectedMovementResident}
                      onChange={(event) =>
                        setSelectedMovementResident(event.target.value)
                      }
                      style={{ width: "100%", marginTop: 8 }}
                    >
                      <option value="">Select resident</option>

                      {qrScanResult.residents.map((resident) => (
                        <option key={resident.id} value={resident.id}>
                          {resident.full_name} — {residentStatus(resident.id)}
                        </option>
                      ))}
                    </select>

                    {selectedMovementResident && (
                      <div style={{ marginTop: 18 }}>
                        <p>
                          Current status:{" "}
                          <strong>
                            {residentStatus(
                              Number(selectedMovementResident)
                            )}
                          </strong>
                        </p>

                        {residentStatus(
                          Number(selectedMovementResident)
                        ) === "Inside" ? (
                          <button
                            type="button"
                            disabled={movementSubmitting}
                            onClick={() =>
                              void handleResidentMovement("Check Out")
                            }
                          >
                            {movementSubmitting
                              ? "Recording..."
                              : "Record Check Out"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={movementSubmitting}
                            onClick={() =>
                              void handleResidentMovement("Check In")
                            }
                          >
                            {movementSubmitting
                              ? "Recording..."
                              : "Record Check In"}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {qrScanResult?.type === "secondary" && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  background: "#f0fdf4",
                  borderRadius: 10,
                }}
              >
                <h3>Service Provider Verified</h3>

                <p>
                  <strong>Name:</strong> {qrScanResult.person.full_name}
                </p>

                <p>
                  <strong>Category:</strong> {qrScanResult.person.category}
                </p>

                <p>
                  <strong>Flat:</strong>{" "}
                  {qrScanResult.person.flat_number ?? "Not available"}
                </p>

                <p>
                  <strong>Linked Resident:</strong>{" "}
                  {qrScanResult.person.primary_resident ?? "Not specified"}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  {qrScanResult.person.active ? "Active" : "Inactive"}
                </p>

                <small>
                  Provider QR verification is supported. Provider movement
                  logging is not included in this workflow yet.
                </small>
              </div>
            )}

            <div className="modal-actions">
              {qrScanResult && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setQrScanResult(null);
                    setSelectedMovementResident("");
                    setQrScanMessage("");
                  }}
                >
                  Scan Another QR
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={closeQRScanner}
              >
                Close
              </button>
            </div>

            <small>
              Camera access requires HTTPS and browser camera permission.
            </small>
          </section>
        </div>
      )}

      {/* VISITOR REGISTRATION MODAL */}

      {showVisitorForm && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !visitorSubmitting) {
              setShowVisitorForm(false);
            }
          }}
        >
          <form className="visitor-modal" onSubmit={handleRegisterVisitor}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">GATE OPERATIONS</span>
                <h3>Register Visitor</h3>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setShowVisitorForm(false)}
                disabled={visitorSubmitting}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <label>
              Visitor name
              <input
                name="visitorName"
                required
                maxLength={100}
                placeholder="Enter full name"
              />
            </label>

            <label>
              Contact number
              <input
                name="phone"
                required
                type="tel"
                inputMode="tel"
                maxLength={20}
                placeholder="Enter phone number"
              />
            </label>

            <label>
              Destination flat
              <select
                name="destination"
                value={visitorFlatId}
                onChange={(event) => setVisitorFlatId(event.target.value)}
                required
                disabled={
                  flatsLoading || flats.length === 0 || visitorSubmitting
                }
              >
                <option value="">
                  {flatsLoading ? "Loading flats..." : "Select destination flat"}
                </option>

                {flats.map((flat) => (
                  <option key={flat.id} value={flat.id}>
                    {flat.building
                      ? `${flat.building} - ${flat.flat_number}`
                      : flat.flat_number}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Purpose of visit
              <select name="purpose" required defaultValue="">
                <option value="" disabled>
                  Select purpose
                </option>
                <option value="Personal Visit">Personal Visit</option>
                <option value="Delivery">Delivery</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Service Provider">Service Provider</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <div className="form-notice">
              Development preview. Use fictional test information only.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowVisitorForm(false)}
                disabled={visitorSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  visitorSubmitting || flatsLoading || flats.length === 0
                }
              >
                {visitorSubmitting ? "Registering..." : "Register Visitor"}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="app-footer">
        <span>GatePass © 2026</span>
        <span>Society access management · Development preview</span>
      </footer>
    </div>
  );
}
