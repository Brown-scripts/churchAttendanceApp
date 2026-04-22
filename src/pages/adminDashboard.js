import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/authContext";
import Navigation from "../components/Navigation";
import { useConfirm } from "../components/ConfirmDialog";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [editingName, setEditingName] = useState(null); // user id being edited
  const [editNameValue, setEditNameValue] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const { user, isAdmin, refreshDisplayNames } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "allowedUsers"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setErrorMsg("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg("");
    setTimeout(() => setSuccessMsg(""), 3500);
  };
  const showError = (msg) => {
    setErrorMsg(msg);
    setSuccessMsg("");
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) { showError("Please enter an email."); return; }
    try {
      const q = query(collection(db, "allowedUsers"), where("email", "==", newEmail.toLowerCase()));
      const existing = await getDocs(q);
      if (!existing.empty) { showError("User already exists."); return; }

      await addDoc(collection(db, "allowedUsers"), {
        email: newEmail.toLowerCase(),
        displayName: newDisplayName.trim() || null,
        role: newRole,
        addedBy: user.email,
        addedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "logs"), {
        action: "User Added",
        details: `Added user ${newEmail}${newDisplayName.trim() ? ` (${newDisplayName.trim()})` : ""} with role ${newRole}`,
        user: user.email,
        timestamp: serverTimestamp(),
      });
      setNewEmail(""); setNewDisplayName(""); setNewRole("user");
      setShowAddModal(false);
      showSuccess(`${newEmail} added successfully`);
      fetchUsers();
      refreshDisplayNames?.();
    } catch (err) {
      showError("Failed to add user.");
    }
  };

  const handleUpdateRole = async (userId, email, role) => {
    try {
      await updateDoc(doc(db, "allowedUsers", userId), {
        role, updatedBy: user.email, updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "logs"), {
        action: "User Role Updated",
        details: `Updated ${email} role to ${role}`,
        user: user.email,
        timestamp: serverTimestamp(),
      });
      showSuccess(`Role updated for ${email}`);
      fetchUsers();
    } catch (err) {
      showError("Failed to update role.");
    }
  };

  const handleUpdateDisplayName = async (userId, email, displayName) => {
    const trimmed = (displayName || "").trim();
    try {
      await updateDoc(doc(db, "allowedUsers", userId), {
        displayName: trimmed || null,
        updatedBy: user.email,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "logs"), {
        action: "User Role Updated",
        details: `Updated display name for ${email}${trimmed ? ` to "${trimmed}"` : " (cleared)"}`,
        user: user.email,
        timestamp: serverTimestamp(),
      });
      setEditingName(null);
      setEditNameValue("");
      showSuccess(`Display name updated for ${email}`);
      fetchUsers();
      refreshDisplayNames?.();
    } catch (err) {
      showError("Failed to update display name.");
    }
  };

  const handleRemove = async (userId, email) => {
    const ok = await confirm({
      title: `Remove ${email}?`,
      message: "They'll lose access to the system immediately. You can re-add them later.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "allowedUsers", userId));
      await addDoc(collection(db, "logs"), {
        action: "User Removed",
        details: `Removed user ${email}`,
        user: user.email,
        timestamp: serverTimestamp(),
      });
      showSuccess(`${email} removed.`);
      fetchUsers();
    } catch (err) {
      showError("Failed to remove user.");
    }
  };

  const kpis = useMemo(() => {
    const admins = users.filter(u => u.role === "admin").length;
    const regular = users.filter(u => u.role === "user").length;
    const thisMonth = users.filter(u => {
      if (!u.addedAt?.seconds) return false;
      const d = new Date(u.addedAt.seconds * 1000);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return { total: users.length, admins, regular, thisMonth };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== "All" && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter]);

  if (!isAdmin()) {
    return (
      <div className="page-content">
        <div className="error-container">
          <h2>Access Denied</h2>
          <p>Administrator access required.</p>
          <button onClick={() => navigate("/")} className="btn-secondary" style={{ marginTop: "1rem" }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="admin-dashboard-container">

          <div className="page-header-clean">
            <h1>Admin Dashboard</h1>
            <p>Manage user access and permissions</p>
          </div>

          {successMsg && (
            <div className="success-banner">
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg("")} className="success-close">×</button>
            </div>
          )}
          {errorMsg && (
            <div className="error-banner">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")} className="error-close">×</button>
            </div>
          )}

          {/* KPI row */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Total Users</div>
              <div className="kpi-value">{kpis.total}</div>
              <div className="kpi-sub">approved accounts</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Admins</div>
              <div className="kpi-value">{kpis.admins}</div>
              <div className="kpi-sub">with full access</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Regular</div>
              <div className="kpi-value">{kpis.regular}</div>
              <div className="kpi-sub">view-only users</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Added This Month</div>
              <div className="kpi-value">{kpis.thisMonth}</div>
              <div className="kpi-sub">new approvals</div>
            </div>
          </div>

          {/* Users list */}
          <div className="table-card">
            <div className="table-header">
              <div className="table-header-left">
                <h3>Users</h3>
                <span className="table-info">{filteredUsers.length} of {users.length}</span>
              </div>
              <div className="table-header-actions">
                <button onClick={fetchUsers} className="refresh-btn-small">Refresh</button>
                <button onClick={() => setShowAddModal(true)} className="btn-primary btn-sm">+ Add User</button>
              </div>
            </div>

            <div className="table-filter-bar">
              <div className="control-group">
                <label>Search</label>
                <input
                  type="text"
                  className="search-input-clean"
                  placeholder="Search email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="control-group">
                <label>Filter by Role</label>
                <select
                  className="select-clean"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="All">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="user">Users</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading-spinner"><div className="spinner" /><p>Loading...</p></div>
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Display Name</th>
                      <th>Role</th>
                      <th>Added</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>
                          {u.email}
                          {u.email === user?.email && (
                            <span className="admin-self-pill">you</span>
                          )}
                        </td>
                        <td>
                          {editingName === u.id ? (
                            <div style={{ display: "flex", gap: "0.375rem" }}>
                              <input
                                type="text"
                                className="form-input"
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                placeholder="Display name..."
                                autoFocus
                                style={{ maxWidth: "180px" }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateDisplayName(u.id, u.email, editNameValue);
                                  if (e.key === "Escape") { setEditingName(null); setEditNameValue(""); }
                                }}
                              />
                              <button className="btn-primary btn-sm" onClick={() => handleUpdateDisplayName(u.id, u.email, editNameValue)}>Save</button>
                              <button className="btn-secondary btn-sm" onClick={() => { setEditingName(null); setEditNameValue(""); }}>×</button>
                            </div>
                          ) : (
                            <span
                              className="cell-editable"
                              onClick={() => { setEditingName(u.id); setEditNameValue(u.displayName || ""); }}
                              style={{ color: u.displayName ? "var(--text-base)" : "var(--text-light)", fontStyle: u.displayName ? "normal" : "italic" }}
                            >
                              {u.displayName || "— add name —"}
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, u.email, e.target.value)}
                            className="role-select"
                            disabled={u.email === user?.email}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                          {u.addedAt ? new Date(u.addedAt.seconds * 1000).toLocaleDateString() : "—"}
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemove(u.id, u.email)}
                            className="btn-danger btn-sm"
                            disabled={u.email === user?.email}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    {users.length === 0 ? "No users found." : "No users match your filters."}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add user modal */}
          {showAddModal && (
            <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Add New User</h2>
                </div>
                <form onSubmit={handleAddUser}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-input"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="user@example.com"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Display Name <span className="text-muted">(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="select-clean">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-buttons">
                    <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">Add User</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
