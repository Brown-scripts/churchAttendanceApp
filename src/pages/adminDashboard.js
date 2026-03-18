import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/authContext";
import Navigation from "../components/Navigation";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

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
        role: newRole,
        addedBy: user.email,
        addedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "logs"), {
        action: "User Added",
        details: `Added user ${newEmail} with role ${newRole}`,
        user: user.email,
        timestamp: serverTimestamp(),
      });
      setNewEmail(""); setNewRole("user");
      showSuccess(`${newEmail} added successfully`);
      fetchUsers();
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

  const handleRemove = async (userId, email) => {
    if (!window.confirm(`Remove ${email}?`)) return;
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

          {/* Add user */}
          <div className="controls-card">
            <div className="controls-header">
              <h3>Add New User</h3>
            </div>
            <form onSubmit={handleAddUser} className="add-user-form">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="select-clean">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="btn-primary">Add User</button>
              </div>
            </form>
          </div>

          {/* Users list */}
          <div className="table-card">
            <div className="table-header">
              <h3>Users ({users.length})</h3>
              <button onClick={fetchUsers} className="refresh-btn-small">Refresh</button>
            </div>

            {loading ? (
              <div className="loading-spinner"><div className="spinner" /><p>Loading...</p></div>
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Added</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>{u.email}</td>
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
                {users.length === 0 && (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No users found.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
