import React, { useState, useEffect, useMemo } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useAuth } from "../context/authContext";
import { AdminOnly } from "../components/RoleBasedAccess";
import Navigation from "../components/Navigation";
import { inferServiceTypeFromDate } from "../utils/serviceType";
import { useAttendanceRecords, useMembers, invalidateCollection } from "../hooks/useFirestoreCollection";
import { useToast } from "../components/Toast";
import { CATEGORIES } from "../constants";
import { Info } from "lucide-react";
import Combobox from "../components/Combobox";

export default function AttendanceForm({ fetchAttendance }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isNewMember, setIsNewMember] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceType, setServiceType] = useState("Sunday");
  const [date, setDate] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [user, setUser] = useState(null);
  const { isAdmin } = useAuth();
  const toast = useToast();

  const { data: membershipRecords } = useMembers();
  const { data: attendanceRecords } = useAttendanceRecords();

  const members = useMemo(() => {
    if (!membershipRecords) return [];
    const seen = new Set();
    return membershipRecords.filter((m) => {
      if (!m.name) return false;
      const key = m.name.toLowerCase().trim().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [membershipRecords]);

  const existingServices = useMemo(() => {
    if (!attendanceRecords) return [];
    const set = new Set();
    attendanceRecords.forEach((d) => { if (d.serviceName) set.add(d.serviceName); });
    return Array.from(set);
  }, [attendanceRecords]);

  // Bulk attendance state
  const [activeTab, setActiveTab] = useState("single");
  const [bulkService, setBulkService] = useState("");
  const [bulkServiceType, setBulkServiceType] = useState("Sunday");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkSelected, setBulkSelected] = useState({});
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState("");
  const [alreadyPresent, setAlreadyPresent] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    setBulkDate(today);
    const inferred = inferServiceTypeFromDate(today);
    setServiceType(inferred);
    setBulkServiceType(inferred);
  }, []);

  // Auto-update type when single-form date changes
  useEffect(() => {
    if (date) setServiceType(inferServiceTypeFromDate(date));
  }, [date]);

  // Auto-update type when bulk date changes
  useEffect(() => {
    if (bulkDate) setBulkServiceType(inferServiceTypeFromDate(bulkDate));
  }, [bulkDate]);

  useEffect(() => {
    const match = members.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    if (match) {
      setIsNewMember(false);
      setCategory(match.category);
    } else if (name.trim() && isAdmin()) {
      setIsNewMember(true);
      setCategory("");
    } else if (name.trim() && !isAdmin()) {
      setIsNewMember(false);
      setCategory("");
    }
  }, [name, members, isAdmin]);

  // When bulk service or date changes, reload who's already present
  useEffect(() => {
    const fetchAlreadyPresent = async () => {
      if (!bulkService || !bulkDate) {
        setAlreadyPresent([]);
        return;
      }
      try {
        const q = query(
          collection(db, "attendance"),
          where("serviceName", "==", bulkService),
          where("date", "==", bulkDate)
        );
        const snap = await getDocs(q);
        setAlreadyPresent(snap.docs.map((d) => d.data().name.toLowerCase().trim()));
      } catch (err) {
        console.error("Error fetching present members:", err);
      }
    };
    fetchAlreadyPresent();
  }, [bulkService, bulkDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalName = name.trim();
    const finalCategory = category;
    const finalService = serviceName.trim();

    if (!finalName || !finalCategory || !finalService || !date) {
      toast.warn("Please fill all required fields.");
      return;
    }

    try {
      const attendanceRef = collection(db, "attendance");
      const duplicateQuery = query(
        attendanceRef,
        where("serviceName", "==", finalService),
        where("date", "==", date)
      );

      const duplicateSnap = await getDocs(duplicateQuery);
      const normalizedName = finalName.toLowerCase().trim();

      const isDuplicate = duplicateSnap.docs.some(doc => {
        const existingName = doc.data().name.toLowerCase().trim();
        return existingName === normalizedName;
      });

      if (isDuplicate) {
        toast.warn(`Attendance already recorded for "${finalName}" in ${finalService} service on ${date}.`);
        return;
      }

      if (isNewMember && isAdmin()) {
        await addDoc(collection(db, "membership"), {
          name: finalName,
          category: finalCategory,
        });
      } else if (isNewMember && !isAdmin()) {
        toast.error("Only administrators can add new members. Please select from existing members.");
        return;
      }

      await addDoc(collection(db, "attendance"), {
        name: finalName,
        category: finalCategory,
        serviceName: finalService,
        serviceType,
        date,
        timestamp: serverTimestamp(),
      });

      await addDoc(collection(db, "logs"), {
        action: "Attendance Added",
        details: `Added attendance for ${finalName} in ${finalService} service on ${date}`,
        user: user?.email || "System",
        timestamp: serverTimestamp(),
        memberName: finalName,
        serviceName: finalService,
        date: date
      });

      setName("");
      setCategory("");
      setServiceName("");
      setIsNewMember(false);
      setSuccessMessage("Attendance submitted successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);

      invalidateCollection("attendance");
      if (isNewMember) invalidateCollection("membership");
      await fetchAttendance?.();
    } catch (err) {
      console.error("Error submitting attendance:", err);
      toast.error(`Submission failed: ${err.message}`);
    }
  };

  const toggleBulkMember = (memberName) => {
    setBulkSelected((prev) => ({
      ...prev,
      [memberName]: !prev[memberName],
    }));
  };

  const toggleAllInCategory = (cat, filteredCatMembers) => {
    const allSelected = filteredCatMembers.every((m) => bulkSelected[m.name]);
    const update = {};
    filteredCatMembers.forEach((m) => {
      update[m.name] = !allSelected;
    });
    setBulkSelected((prev) => ({ ...prev, ...update }));
  };

  const handleBulkSubmit = async () => {
    const selectedMembers = members.filter((m) => bulkSelected[m.name]);

    if (!bulkService.trim()) {
      toast.warn("Please enter a service name.");
      return;
    }
    if (!bulkDate) {
      toast.warn("Please select a date.");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.warn("Please select at least one member.");
      return;
    }

    setBulkLoading(true);

    try {
      let addedCount = 0;
      let skippedCount = 0;
      const addedNames = [];

      for (const member of selectedMembers) {
        const normalizedName = member.name.toLowerCase().trim();
        if (alreadyPresent.includes(normalizedName)) {
          skippedCount++;
          continue;
        }

        await addDoc(collection(db, "attendance"), {
          name: member.name,
          category: member.category,
          serviceName: bulkService.trim(),
          serviceType: bulkServiceType,
          date: bulkDate,
          timestamp: serverTimestamp(),
        });

        addedNames.push(member.name);
        addedCount++;
      }

      // Single summary log entry for the whole bulk operation
      if (addedCount > 0) {
        await addDoc(collection(db, "logs"), {
          action: "Bulk Attendance Added",
          details: `Marked ${addedCount} members present in ${bulkService.trim()} on ${bulkDate}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`,
          user: user?.email || "System",
          timestamp: serverTimestamp(),
          serviceName: bulkService.trim(),
          serviceType: bulkServiceType,
          date: bulkDate,
          memberCount: addedCount,
          members: addedNames,
        });
      }

      setBulkSelected({});
      // Refresh already-present list
      const q = query(
        collection(db, "attendance"),
        where("serviceName", "==", bulkService.trim()),
        where("date", "==", bulkDate)
      );
      const snap = await getDocs(q);
      setAlreadyPresent(snap.docs.map((d) => d.data().name.toLowerCase().trim()));

      const msg = skippedCount > 0
        ? `Marked ${addedCount} present. ${skippedCount} already recorded.`
        : `Marked ${addedCount} members present!`;
      setBulkSuccessMessage(msg);
      setTimeout(() => setBulkSuccessMessage(""), 5000);
      if (addedCount > 0) invalidateCollection("attendance");
      await fetchAttendance?.();
    } catch (err) {
      console.error("Error in bulk submit:", err);
      toast.error(`Bulk submission failed: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const filteredBulkMembers = members.filter((m) =>
    m.name.toLowerCase().includes(bulkSearchTerm.toLowerCase())
  );

  const selectedCount = Object.values(bulkSelected).filter(Boolean).length;

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="attendance-container">
          <div className="page-header-clean">
            <h1>Attendance Management</h1>
            <p>Record member attendance for services and events</p>
          </div>

          {/* Tabs */}
          <div className="attendance-tabs">
            <button
              className={`tab-btn ${activeTab === "single" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("single")}
            >
              Single Member
            </button>
            <AdminOnly>
              <button
                className={`tab-btn ${activeTab === "bulk" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("bulk")}
              >
                Bulk Mark Present
              </button>
            </AdminOnly>
          </div>

          {/* ── SINGLE MEMBER TAB ── */}
          {activeTab === "single" && (
            <div className="form-container">
              {successMessage && (
                <div className="success-banner">
                  <span>{successMessage}</span>
                  <button onClick={() => setSuccessMessage("")} className="success-close">×</button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="attendance-form">
                {!isAdmin() && (
                  <div className="info-banner">
                    <Info size={16} strokeWidth={2.5} className="info-banner-icon" />
                    <span>You can only select from existing members. Contact an admin to add new members.</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="name" className="form-label">
                    Name {!isAdmin() && <span className="text-muted">(Select from existing members only)</span>}
                  </label>
                  <Combobox
                    id="name"
                    value={name}
                    onChange={setName}
                    options={members.map((m) => m.name)}
                    placeholder={isAdmin() ? "Type or select member name…" : "Select a member…"}
                    allowFreeText={isAdmin()}
                    emptyText={isAdmin() ? "No match — will be added as a new member" : "No matching member"}
                    required
                  />
                </div>

                {isNewMember && isAdmin() ? (
                  <AdminOnly>
                    <div className="form-group">
                      <label htmlFor="new-category" className="form-label">
                        Category <span className="text-muted">(Admin: New Member)</span>
                      </label>
                      <select
                        id="new-category"
                        className="form-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="L100">L100</option>
                        <option value="L200">L200</option>
                        <option value="L300">L300</option>
                        <option value="L400">L400</option>
                        <option value="Worker">Worker</option>
                        <option value="Other">Other</option>
                        <option value="New">New Member</option>
                      </select>
                    </div>
                  </AdminOnly>
                ) : (
                  <div className="form-group">
                    <label htmlFor="category" className="form-label">Category</label>
                    <input
                      id="category"
                      className="form-input readonly"
                      type="text"
                      value={category}
                      readOnly
                      placeholder="Category will auto-fill"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="service">Service</label>
                  <Combobox
                    id="service"
                    value={serviceName}
                    onChange={setServiceName}
                    options={existingServices}
                    placeholder="Type or select service"
                    allowFreeText
                    emptyText="No match — will be added as a new service"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Service Type</label>
                  <div className="service-type-toggle">
                    <button
                      type="button"
                      className={`service-type-btn ${serviceType === "Sunday" ? "active" : ""}`}
                      onClick={() => setServiceType("Sunday")}
                    >Sunday</button>
                    <button
                      type="button"
                      className={`service-type-btn ${serviceType === "Monday" ? "active" : ""}`}
                      onClick={() => setServiceType("Monday")}
                    >Monday</button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="date" className="form-label">Date</label>
                  <input
                    id="date"
                    className="form-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="submit-btn">
                  Submit Attendance
                </button>
              </form>
            </div>
          )}

          {/* ── BULK MARK PRESENT TAB ── */}
          {activeTab === "bulk" && (
            <AdminOnly>
              <div className="form-container bulk-attendance-container">
                {bulkSuccessMessage && (
                  <div className="success-banner">
                    <span>{bulkSuccessMessage}</span>
                    <button onClick={() => setBulkSuccessMessage("")} className="success-close">×</button>
                  </div>
                )}

                {/* Service + Date row */}
                <div className="bulk-service-row">
                  <div className="form-group">
                    <label className="form-label">Service</label>
                    <Combobox
                      value={bulkService}
                      onChange={setBulkService}
                      options={existingServices}
                      placeholder="Type or select service…"
                      allowFreeText
                      emptyText="No match — will be added as a new service"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={bulkDate}
                      onChange={(e) => setBulkDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Service Type</label>
                  <div className="service-type-toggle">
                    <button
                      type="button"
                      className={`service-type-btn ${bulkServiceType === "Sunday" ? "active" : ""}`}
                      onClick={() => setBulkServiceType("Sunday")}
                    >Sunday</button>
                    <button
                      type="button"
                      className={`service-type-btn ${bulkServiceType === "Monday" ? "active" : ""}`}
                      onClick={() => setBulkServiceType("Monday")}
                    >Monday</button>
                  </div>
                </div>

                {/* Search row */}
                <div className="form-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search members..."
                    value={bulkSearchTerm}
                    onChange={(e) => setBulkSearchTerm(e.target.value)}
                  />
                </div>

                {/* Submit row */}
                <div className="bulk-submit-row">
                  <span className="bulk-selected-count">
                    {selectedCount} selected
                  </span>
                  <button
                    className="submit-btn"
                    onClick={handleBulkSubmit}
                    disabled={bulkLoading || selectedCount === 0}
                  >
                    {bulkLoading ? "Saving..." : `Mark ${selectedCount} Present`}
                  </button>
                </div>

                {/* Members checklist grouped by category — collapsible */}
                <div className="bulk-member-list">
                  {CATEGORIES.map((cat) => {
                    const catMembers = filteredBulkMembers.filter((m) => m.category === cat);
                    if (catMembers.length === 0) return null;

                    const allSelected = catMembers.every((m) => bulkSelected[m.name]);
                    const someSelected = catMembers.some((m) => bulkSelected[m.name]);
                    const isOpen = !!expandedCategories[cat];
                    const selectedInCat = catMembers.filter((m) => bulkSelected[m.name]).length;

                    return (
                      <div key={cat} className="bulk-category-group">
                        <div
                          className="bulk-category-header"
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
                          }
                        >
                          <label
                            className="bulk-category-label"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => toggleAllInCategory(cat, catMembers)}
                            />
                            <span>{cat}</span>
                            <span className="bulk-cat-count">
                              {catMembers.length} members
                              {selectedInCat > 0 && (
                                <span style={{ color: "var(--accent)", fontWeight: 700, marginLeft: "0.4rem" }}>
                                  · {selectedInCat} selected
                                </span>
                              )}
                            </span>
                          </label>
                          <span style={{ marginLeft: "auto", paddingLeft: "0.75rem", color: "var(--text-muted)", fontSize: "1rem", lineHeight: 1 }}>
                            {isOpen ? "▲" : "▼"}
                          </span>
                        </div>
                        {isOpen && (
                          <div className="bulk-members-list-col">
                            {catMembers.map((m) => {
                              const isPresent = alreadyPresent.includes(m.name.toLowerCase().trim());
                              return (
                                <label
                                  key={m.name}
                                  className={`bulk-member-item ${isPresent ? "already-present" : ""} ${bulkSelected[m.name] ? "member-selected" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!bulkSelected[m.name]}
                                    onChange={() => toggleBulkMember(m.name)}
                                    disabled={isPresent}
                                  />
                                  <span className="bulk-member-name">{m.name}</span>
                                  {isPresent && <span className="present-badge">Present</span>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredBulkMembers.length === 0 && (
                    <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>
                      No members found.
                    </p>
                  )}
                </div>
              </div>
            </AdminOnly>
          )}

        </div>
      </div>
    </>
  );
}
