import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/authContext";
import Navigation from "../components/Navigation";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Fetch all allowed users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "allowedUsers"));
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      setErrorMessage("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Add new user
  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!newUserEmail.trim()) {
      setErrorMessage("Please enter an email address");
      return;
    }

    try {
      // Check if user already exists
      const q = query(
        collection(db, "allowedUsers"),
        where("email", "==", newUserEmail.toLowerCase())
      );
      const existingUser = await getDocs(q);
      
      if (!existingUser.empty) {
        setErrorMessage("User already exists");
        return;
      }

      // Add new user
      await addDoc(collection(db, "allowedUsers"), {
        email: newUserEmail.toLowerCase(),
        role: newUserRole,
        addedBy: user.email,
        addedAt: serverTimestamp()
      });

      // Log the action
      await addDoc(collection(db, "logs"), {
        action: "User Added",
        details: `Added user ${newUserEmail} with role ${newUserRole}`,
        user: user.email,
        timestamp: serverTimestamp()
      });

      setSuccessMessage(`User ${newUserEmail} added successfully`);
      setNewUserEmail("");
      setNewUserRole("user");
      fetchUsers();
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error adding user:", error);
      setErrorMessage("Failed to add user");
    }
  };

  // Update user role
  const handleUpdateRole = async (userId, currentEmail, newRole) => {
    try {
      await updateDoc(doc(db, "allowedUsers", userId), {
        role: newRole,
        updatedBy: user.email,
        updatedAt: serverTimestamp()
      });

      // Log the action
      await addDoc(collection(db, "logs"), {
        action: "User Role Updated",
        details: `Updated ${currentEmail} role to ${newRole}`,
        user: user.email,
        timestamp: serverTimestamp()
      });

      setSuccessMessage(`Role updated for ${currentEmail}`);
      fetchUsers();
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error updating role:", error);
      setErrorMessage("Failed to update role");
    }
  };

  // Remove user
  const handleRemoveUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${userEmail}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "allowedUsers", userId));

      // Log the action
      await addDoc(collection(db, "logs"), {
        action: "User Removed",
        details: `Removed user ${userEmail}`,
        user: user.email,
        timestamp: serverTimestamp()
      });

      setSuccessMessage(`User ${userEmail} removed successfully`);
      fetchUsers();
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error removing user:", error);
      setErrorMessage("Failed to remove user");
    }
  };

  // Clear messages
  const clearMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  if (!isAdmin()) {
    return (
      <div className="page-content">
        <div className="error-container">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="admin-dashboard-container">
          {/* Page Header */}
          <div className="page-header-clean">
            <h1>Admin Dashboard</h1>
            <p>Manage user access and permissions</p>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="success-banner">
              <span>{successMessage}</span>
              <button onClick={clearMessages} className="success-close">×</button>
            </div>
          )}

          {errorMessage && (
            <div className="error-banner">
              <span>{errorMessage}</span>
              <button onClick={clearMessages} className="error-close">×</button>
            </div>
          )}

          {/* Add User Form */}
          <div className="controls-card">
            <h3>Add New User</h3>
            <form onSubmit={handleAddUser} className="add-user-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Enter user email..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="select-clean"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <button type="submit" className="btn-primary">
                Add User
              </button>
            </form>
          </div>

          {/* Users List */}
          <div className="controls-card">
            <h3>Manage Users ({users.length})</h3>
            
            {loading ? (
              <div className="loading-spinner">Loading users...</div>
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Added Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userData) => (
                      <tr key={userData.id}>
                        <td>{userData.email}</td>
                        <td>
                          <select
                            value={userData.role}
                            onChange={(e) => handleUpdateRole(userData.id, userData.email, e.target.value)}
                            className="role-select"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          {userData.addedAt ? 
                            new Date(userData.addedAt.seconds * 1000).toLocaleDateString() : 
                            'N/A'
                          }
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemoveUser(userData.id, userData.email)}
                            className="btn-danger btn-sm"
                            disabled={userData.email === user.email}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Floating Quick Access Menu */}
          <div className="floating-quick-menu">
            <div className="quick-menu-item" onClick={() => navigate('/')} title="Home">
              <span className="menu-icon">🏠</span>
            </div>
            <div className="quick-menu-item" onClick={() => navigate('/membership')} title="Membership">
              <span className="menu-icon">👥</span>
            </div>
            <div className="quick-menu-item" onClick={() => navigate('/logs')} title="Audit Logs">
              <span className="menu-icon">📋</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
