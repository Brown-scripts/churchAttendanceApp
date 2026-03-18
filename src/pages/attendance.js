import React, { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useAuth } from "../context/authContext";
import { AdminOnly } from "../components/RoleBasedAccess";
import Navigation from "../components/Navigation";

export default function AttendanceForm({ fetchAttendance }) {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isNewMember, setIsNewMember] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [date, setDate] = useState("");
  const [existingServices, setExistingServices] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [user, setUser] = useState(null);
  const { isAdmin } = useAuth();

  // Bulk attendance state
  const [activeTab, setActiveTab] = useState("single");
  const [bulkService, setBulkService] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkSelected, setBulkSelected] = useState({});
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState("");
  const [alreadyPresent, setAlreadyPresent] = useState([]);

  const navigate = useNavigate();
  const auth = getAuth();

  const categories = ["L100", "L200", "L300", "L400", "Worker", "Other", "New"];

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
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "membership"));
        const list = snapshot.docs.map((doc) => doc.data());
        const seen = new Set();
        const deduped = list.filter((m) => {
          const key = m.name.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setMembers(deduped);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const snapshot = await getDocs(collection(db, "attendance"));
        const serviceSet = new Set();
        snapshot.forEach((doc) => serviceSet.add(doc.data().serviceName));
        setExistingServices([...serviceSet]);
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };
    fetchServices();
  }, []);

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
      alert("Please fill all required fields.");
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
        alert(`Attendance already recorded for "${finalName}" in ${finalService} service on ${date}.`);
        return;
      }

      if (isNewMember && isAdmin()) {
        await addDoc(collection(db, "membership"), {
          name: finalName,
          category: finalCategory,
        });
      } else if (isNewMember && !isAdmin()) {
        alert("Only administrators can add new members. Please select from existing members.");
        return;
      }

      await addDoc(collection(db, "attendance"), {
        name: finalName,
        category: finalCategory,
        serviceName: finalService,
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

      await fetchAttendance?.();
    } catch (err) {
      console.error("Error submitting attendance:", err);
      alert(`Submission failed: ${err.message}`);
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
      alert("Please enter a service name.");
      return;
    }
    if (!bulkDate) {
      alert("Please select a date.");
      return;
    }
    if (selectedMembers.length === 0) {
      alert("Please select at least one member.");
      return;
    }

    setBulkLoading(true);

    try {
      let addedCount = 0;
      let skippedCount = 0;

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
          date: bulkDate,
          timestamp: serverTimestamp(),
        });

        await addDoc(collection(db, "logs"), {
          action: "Attendance Added",
          details: `Bulk: Added attendance for ${member.name} in ${bulkService} on ${bulkDate}`,
          user: user?.email || "System",
          timestamp: serverTimestamp(),
          memberName: member.name,
          serviceName: bulkService.trim(),
          date: bulkDate,
        });

        addedCount++;
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
      await fetchAttendance?.();
    } catch (err) {
      console.error("Error in bulk submit:", err);
      alert(`Bulk submission failed: ${err.message}`);
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
                    <span>ℹ️ You can only select from existing members. Contact an admin to add new members.</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="name" className="form-label">
                    Name {!isAdmin() && <span className="text-muted">(Select from existing members only)</span>}
                  </label>
                  {isAdmin() ? (
                    <input
                      list="member-options"
                      id="name"
                      className="form-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Type or select member name..."
                      required
                    />
                  ) : (
                    <select
                      id="name"
                      className="form-select"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    >
                      <option value="">Select a member...</option>
                      {members.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  )}
                  <datalist id="member-options">
                    {members.map((m) => (
                      <option key={m.name} value={m.name} />
                    ))}
                  </datalist>
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
                  <input
                    list="service-options"
                    id="service"
                    className="form-input"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Type or select service"
                    required
                  />
                  <datalist id="service-options">
                    {existingServices.map((srv) => (
                      <option key={srv} value={srv} />
                    ))}
                  </datalist>
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
                    <input
                      list="bulk-service-options"
                      className="form-input"
                      value={bulkService}
                      onChange={(e) => setBulkService(e.target.value)}
                      placeholder="Type or select service..."
                    />
                    <datalist id="bulk-service-options">
                      {existingServices.map((srv) => (
                        <option key={srv} value={srv} />
                      ))}
                    </datalist>
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

                {/* Members checklist grouped by category */}
                <div className="bulk-member-list">
                  {categories.map((cat) => {
                    const catMembers = filteredBulkMembers.filter((m) => m.category === cat);
                    if (catMembers.length === 0) return null;

                    const allSelected = catMembers.every((m) => bulkSelected[m.name]);
                    const someSelected = catMembers.some((m) => bulkSelected[m.name]);

                    return (
                      <div key={cat} className="bulk-category-group">
                        <div className="bulk-category-header">
                          <label className="bulk-category-label">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => toggleAllInCategory(cat, catMembers)}
                            />
                            <span>{cat}</span>
                            <span className="bulk-cat-count">{catMembers.length} members</span>
                          </label>
                        </div>
                        <div className="bulk-members-grid">
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

          {/* Floating Quick Access Menu */}
          <div className="floating-quick-menu">
            <div className="quick-menu-item" onClick={() => navigate("/")} title="Home">
              <span className="menu-icon">🏠</span>
            </div>
            <div className="quick-menu-item" onClick={() => navigate("/analytics")} title="Analytics">
              <span className="menu-icon">📊</span>
            </div>
            <div className="quick-menu-item" onClick={() => navigate("/membership")} title="Membership">
              <span className="menu-icon">👥</span>
            </div>
            <div className="quick-menu-item" onClick={() => navigate("/logs")} title="Audit Logs">
              <span className="menu-icon">📋</span>
            </div>
            <AdminOnly>
              <div className="quick-menu-item" onClick={() => navigate("/admin")} title="Admin Dashboard">
                <span className="menu-icon">⚙️</span>
              </div>
            </AdminOnly>
          </div>
        </div>
      </div>
    </>
  );
}
