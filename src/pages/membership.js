import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { AdminOnly } from '../components/RoleBasedAccess';
import Navigation from '../components/Navigation';

const Membership = () => {
  const [user] = useAuthState(auth);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [editingName, setEditingName] = useState(null);
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [bulkFromCategory, setBulkFromCategory] = useState('');
  const [bulkToCategory, setBulkToCategory] = useState('');

  const categories = ['L100', 'L200', 'L300', 'L400', 'Worker', 'Other', 'New'];

  // Utility function to normalize names for comparison
  const normalizeName = (name) => {
    return name.trim().toLowerCase();
  };

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const attendanceRef = collection(db, 'membership');
      const attendanceSnapshot = await getDocs(attendanceRef);

      // Create a map to store unique members with their latest category
      const memberMap = new Map();

      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const normalizedName = normalizeName(data.name);

        if (!memberMap.has(normalizedName) ||
            (data.timestamp && memberMap.get(normalizedName).timestamp < data.timestamp)) {
          memberMap.set(normalizedName, {
            id: doc.id,
            name: data.name.trim(),
            category: data.category,
            timestamp: data.timestamp,
            normalizedName: normalizedName
          });
        }
      });

      setMembers(Array.from(memberMap.values()));
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleCategoryChange = async (member, category) => {
    if (!category) {
      alert('Please select a category.');
      return;
    }

    try {
      // Get all collections for this member (case-insensitive)
      const attendanceQuery = query(collection(db, 'attendance'));
      const attendanceSnapshot = await getDocs(attendanceQuery);

      const membershipQuery = query(collection(db, 'membership'));
      const membershipSnapshot = await getDocs(membershipQuery);

      // Update membership collection records
      const matchingMembershipDocs = membershipSnapshot.docs.filter(doc =>
        normalizeName(doc.data().name) === normalizeName(member.name)
      );

      for (const membershipDoc of matchingMembershipDocs) {
        await updateDoc(doc(db, 'membership', membershipDoc.id), {
          category: category
        });
      }

      // Update attendance collection records
      const matchingAttendanceDocs = attendanceSnapshot.docs.filter(doc =>
        normalizeName(doc.data().name) === normalizeName(member.name)
      );

      for (const attendanceDoc of matchingAttendanceDocs) {
        await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
          category: category
        });
      }

      // Log the category change
      await addDoc(collection(db, 'logs'), {
        action: 'Category Change',
        details: `Changed ${member.name}'s category from ${member.category} to ${category}`,
        user: user?.email || 'Unknown',
        timestamp: serverTimestamp(),
        memberName: member.name,
        oldCategory: member.category,
        newCategory: category
      });

      // Clear editing state
      setEditingMember(null);
      setNewCategory('');

      // Show success message
      alert(`Successfully updated ${member.name}'s category to ${category}.`);

      // Refresh the data to ensure consistency with database
      await fetchMembers();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Error updating category. Please try again.');
    }
  };

  const handleNameChange = async (member, newName) => {
    if (!newName || !newName.trim()) {
      alert('Please enter a valid name.');
      return;
    }

    const trimmedNewName = newName.trim();

    // Check for duplicates (case-insensitive)
    const isDuplicate = members.some(m =>
      normalizeName(m.name) === normalizeName(trimmedNewName) &&
      normalizeName(m.name) !== normalizeName(member.name)
    );

    if (isDuplicate) {
      alert('A member with this name already exists.');
      return;
    }

    try {
      // Get all collections for this member
      const attendanceQuery = query(collection(db, 'attendance'));
      const attendanceSnapshot = await getDocs(attendanceQuery);

      const membershipQuery = query(collection(db, 'membership'));
      const membershipSnapshot = await getDocs(membershipQuery);

      // Update membership collection records (case-insensitive)
      const matchingMembershipDocs = membershipSnapshot.docs.filter(doc =>
        normalizeName(doc.data().name) === normalizeName(member.name)
      );

      for (const membershipDoc of matchingMembershipDocs) {
        await updateDoc(doc(db, 'membership', membershipDoc.id), {
          name: trimmedNewName
        });
      }

      // Update attendance collection records (case-insensitive)
      const matchingAttendanceDocs = attendanceSnapshot.docs.filter(doc =>
        normalizeName(doc.data().name) === normalizeName(member.name)
      );

      for (const attendanceDoc of matchingAttendanceDocs) {
        await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
          name: trimmedNewName
        });
      }

      // Log the name change
      await addDoc(collection(db, 'logs'), {
        action: 'Name Change',
        details: `Changed member name from ${member.name} to ${trimmedNewName}`,
        user: user?.email || 'Unknown',
        timestamp: serverTimestamp(),
        memberName: trimmedNewName,
        oldName: member.name,
        newName: trimmedNewName
      });

      // Clear editing state first
      setEditingName(null);
      setNewName('');

      // Show success message
      alert(`Successfully updated member name to "${trimmedNewName}".`);

      // Refresh the data to get updated state from database
      await fetchMembers();
    } catch (error) {
      console.error('Error updating name:', error);
      alert('Error updating name. Please try again.');
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (!bulkFromCategory || !bulkToCategory) {
      alert('Please select both source and target categories.');
      return;
    }

    if (bulkFromCategory === bulkToCategory) {
      alert('Source and target categories cannot be the same.');
      return;
    }

    try {
      // Find all members in the source category
      const membersToUpdate = members.filter(m => m.category === bulkFromCategory);

      if (membersToUpdate.length === 0) {
        alert(`No members found in ${bulkFromCategory} category.`);
        return;
      }

      const confirmUpdate = window.confirm(
        `This will update ${membersToUpdate.length} members from ${bulkFromCategory} to ${bulkToCategory}. Continue?`
      );

      if (!confirmUpdate) return;

      let updatedCount = 0;

      // Get all collections once for efficiency
      const attendanceQuery = query(collection(db, 'attendance'));
      const attendanceSnapshot = await getDocs(attendanceQuery);

      const membershipQuery = query(collection(db, 'membership'));
      const membershipSnapshot = await getDocs(membershipQuery);

      // Update database records for each member in the source category
      for (const member of membersToUpdate) {
        // Update membership collection records (case-insensitive)
        const matchingMembershipDocs = membershipSnapshot.docs.filter(doc =>
          normalizeName(doc.data().name) === normalizeName(member.name)
        );

        for (const membershipDoc of matchingMembershipDocs) {
          await updateDoc(doc(db, 'membership', membershipDoc.id), {
            category: bulkToCategory
          });
        }

        // Update attendance collection records (case-insensitive)
        const matchingAttendanceDocs = attendanceSnapshot.docs.filter(doc =>
          normalizeName(doc.data().name) === normalizeName(member.name)
        );

        for (const attendanceDoc of matchingAttendanceDocs) {
          await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
            category: bulkToCategory
          });
        }

        // Log the bulk category change
        await addDoc(collection(db, 'logs'), {
          action: 'Bulk Category Update',
          details: `Bulk updated ${member.name}'s category from ${bulkFromCategory} to ${bulkToCategory}`,
          user: user?.email || 'Unknown',
          timestamp: serverTimestamp(),
          memberName: member.name,
          oldCategory: bulkFromCategory,
          newCategory: bulkToCategory
        });

        updatedCount++;
      }

      // Clear selections
      setBulkFromCategory('');
      setBulkToCategory('');

      alert(`Successfully updated ${updatedCount} members from ${bulkFromCategory} to ${bulkToCategory}.`);

      // Refresh the data to ensure consistency
      await fetchMembers();
    } catch (error) {
      console.error('Error updating categories:', error);
      alert('Error updating categories. Please try again.');
    }
  };



  const filteredAndSortedMembers = members
    .filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || member.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'name') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });





  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="membership-container">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading members...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="membership-container">
        {/* Page Header */}
        <div className="page-header-clean">
          <h1>Membership Management</h1>
          <p>Manage church members and their categories</p>
        </div>

        {/* Role-based access notice */}
        {!isAdmin() && (
          <div className="info-banner">
            <span>ℹ️ You have view-only access. Contact an admin to edit member information or perform bulk updates.</span>
          </div>
        )}

        {/* Controls Card */}
        <div className="controls-card">
          <div className="controls-header">
            <h3>Search & Filter</h3>
            <button onClick={fetchMembers} className="refresh-btn-small">
              Refresh
            </button>
          </div>

          <div className="controls-grid">
            <div className="control-group">
              <label>Search Members</label>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-clean"
              />
            </div>

            <div className="control-group">
              <label>Filter by Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="select-clean"
              >
                <option value="All">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label>Sort Order</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="select-clean"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="category-asc">Category (A-Z)</option>
                <option value="category-desc">Category (Z-A)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Update Card - Admin Only */}
        <AdminOnly>
          <div className="bulk-update-card">
          <div className="bulk-header">
            <h3>Bulk Category Update</h3>
            <span className="bulk-info">Update all members from one category to another</span>
          </div>
          <div className="bulk-controls">
            <div className="bulk-select-group">
              <label>From Category</label>
              <select
                value={bulkFromCategory}
                onChange={(e) => setBulkFromCategory(e.target.value)}
                className="select-clean"
              >
                <option value="">Select source category...</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="bulk-select-group">
              <label>To Category</label>
              <select
                value={bulkToCategory}
                onChange={(e) => setBulkToCategory(e.target.value)}
                className="select-clean"
              >
                <option value="">Select target category...</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="bulk-actions">
              <button
                onClick={handleBulkCategoryUpdate}
                disabled={!bulkFromCategory || !bulkToCategory}
                className="btn-primary"
              >
                Bulk Update
              </button>
              <button
                onClick={() => {
                  setBulkFromCategory('');
                  setBulkToCategory('');
                }}
                className="btn-secondary"
              >
                Clear
              </button>
            </div>
          </div>
          </div>
        </AdminOnly>

        {/* Statistics Card */}
        <div className="stats-card">
          <div className="stats-header">
            <h3>Membership Statistics</h3>

          </div>
          <div className="stats-grid">
            <div className="stat-item total">
              <div className="stat-label">Total Members</div>
              <div className="stat-value">{filteredAndSortedMembers.length}</div>
            </div>
            {categories.map(category => (
              <div key={category} className="stat-item">
                <div className="stat-label">{category}</div>
                <div className="stat-value">
                  {filteredAndSortedMembers.filter(m => m.category === category).length}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members Table Card */}
        <div className="table-card">
          <div className="table-header">
            <h3>Members List</h3>
            <div className="table-info">
              Showing {filteredAndSortedMembers.length} members
            </div>
          </div>
          <div className="table-container-clean">
            <table className="members-table-clean">
              <thead>
                <tr>
                  <th className="name-col">Member Name</th>
                  <th className="category-col">Category</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
          <tbody>
            {filteredAndSortedMembers.map((member) => (
              <tr key={member.normalizedName}>
                <td className="member-name">
                  {editingName === member.name ? (
                    <div className="edit-name-controls">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="name-input"
                        placeholder="Enter new name..."
                      />
                      <button
                        onClick={() => handleNameChange(member, newName)}
                        disabled={!newName.trim()}
                        className="save-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingName(null);
                          setNewName('');
                        }}
                        className="cancel-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="name-display">
                      <span>{member.name}</span>
                      <AdminOnly>
                        <button
                          onClick={() => {
                            setEditingName(member.name);
                            setNewName(member.name);
                          }}
                          className="edit-name-btn"
                          title="Edit name (Admin only)"
                        >
                          ✏️
                        </button>
                      </AdminOnly>
                    </div>
                  )}
                </td>
                <td className="member-category">
                  {editingMember === member.name ? (
                    <div className="edit-category-controls">
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="select-clean"
                      >
                        <option value="">Select category...</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleCategoryChange(member, newCategory)}
                        disabled={!newCategory}
                        className="save-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingMember(null);
                          setNewCategory('');
                        }}
                        className="cancel-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className={`category-badge category-${member.category.toLowerCase()}`}>
                      {member.category}
                    </span>
                  )}
                </td>
                <td className="member-actions">
                  {editingMember !== member.name && (
                    <AdminOnly>
                      <button
                        onClick={() => {
                          setEditingMember(member.name);
                          setNewCategory(member.category);
                        }}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                    </AdminOnly>
                  )}
                  {!isAdmin() && editingMember !== member.name && (
                    <span className="text-muted">View Only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedMembers.length === 0 && (
        <div className="no-members-card">
          <p>No members found matching your criteria.</p>
        </div>
      )}
    </div>

    {/* Floating Quick Access Menu */}
    <div className="floating-quick-menu">
      <div className="quick-menu-item" onClick={() => navigate('/')} title="Dashboard">
        <span className="menu-icon">🏠</span>
      </div>
      <div className="quick-menu-item" onClick={() => navigate('/attendance')} title="Add Attendance">
        <span className="menu-icon">➕</span>
      </div>
      <div className="quick-menu-item" onClick={() => navigate('/analytics')} title="Analytics">
        <span className="menu-icon">📊</span>
      </div>
      <div className="quick-menu-item" onClick={() => navigate('/logs')} title="Audit Logs">
        <span className="menu-icon">📋</span>
      </div>
    </div>

        </div>
      </div>
    </>
  );
};

export default Membership;