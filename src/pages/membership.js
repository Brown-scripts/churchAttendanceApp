import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { AdminOnly } from '../components/RoleBasedAccess';
import Navigation from '../components/Navigation';

const categories = ['L100', 'L200', 'L300', 'L400', 'Worker', 'Other', 'New'];

const normalizeName = (name) => name.trim().toLowerCase();

// ── Streak calculation ────────────────────────────────────────────────────────
// serviceDates: sorted array of all unique service dates (strings YYYY-MM-DD)
// memberDates: set of dates this member attended
const computeStreaks = (serviceDates, memberDatesSet) => {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (const date of serviceDates) {
    if (memberDatesSet.has(date)) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Current streak = streak counting backwards from the last service date
  for (let i = serviceDates.length - 1; i >= 0; i--) {
    if (memberDatesSet.has(serviceDates[i])) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
};

const Membership = () => {
  const [user] = useAuthState(auth);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('members');
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

  // Streak state
  const [streaks, setStreaks] = useState([]);
  const [streaksLoading, setStreaksLoading] = useState(false);
  const [streakSortBy, setStreakSortBy] = useState('currentStreak');
  const [streakFilter, setStreakFilter] = useState('All');
  const [streakSearch, setStreakSearch] = useState('');

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const attendanceRef = collection(db, 'membership');
      const attendanceSnapshot = await getDocs(attendanceRef);

      const memberMap = new Map();
      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const normalized = normalizeName(data.name);
        if (!memberMap.has(normalized) ||
            (data.timestamp && memberMap.get(normalized).timestamp < data.timestamp)) {
          memberMap.set(normalized, {
            id: doc.id,
            name: data.name.trim(),
            category: data.category,
            timestamp: data.timestamp,
            normalizedName: normalized,
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

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const fetchStreaks = useCallback(async () => {
    setStreaksLoading(true);
    try {
      const snap = await getDocs(collection(db, 'attendance'));

      // Build: allServiceDates (unique, across all services), memberAttendance map
      const serviceDatesSet = new Set();
      const memberAttendance = new Map(); // normalizedName -> { name, category, dates: Set }

      snap.docs.forEach(d => {
        const { name, category, date } = d.data();
        if (!name || !date) return;
        serviceDatesSet.add(date);
        const key = normalizeName(name);
        if (!memberAttendance.has(key)) {
          memberAttendance.set(key, { name: name.trim(), category, dates: new Set() });
        }
        memberAttendance.get(key).dates.add(date);
      });

      const sortedDates = Array.from(serviceDatesSet).sort();

      const streakData = Array.from(memberAttendance.values()).map(({ name, category, dates }) => {
        const { currentStreak, longestStreak } = computeStreaks(sortedDates, dates);
        return { name, category, currentStreak, longestStreak, totalAttended: dates.size };
      });

      setStreaks(streakData);
    } catch (err) {
      console.error('Error computing streaks:', err);
    } finally {
      setStreaksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'streaks') fetchStreaks();
  }, [activeTab, fetchStreaks]);

  const handleCategoryChange = async (member, category) => {
    if (!category) { alert('Please select a category.'); return; }
    try {
      const attendanceSnapshot = await getDocs(query(collection(db, 'attendance')));
      const membershipSnapshot = await getDocs(query(collection(db, 'membership')));

      const matchingMembershipDocs = membershipSnapshot.docs.filter(d =>
        normalizeName(d.data().name) === normalizeName(member.name)
      );
      for (const membershipDoc of matchingMembershipDocs) {
        await updateDoc(doc(db, 'membership', membershipDoc.id), { category });
      }

      const matchingAttendanceDocs = attendanceSnapshot.docs.filter(d =>
        normalizeName(d.data().name) === normalizeName(member.name)
      );
      for (const attendanceDoc of matchingAttendanceDocs) {
        await updateDoc(doc(db, 'attendance', attendanceDoc.id), { category });
      }

      await addDoc(collection(db, 'logs'), {
        action: 'Category Change',
        details: `Changed ${member.name}'s category from ${member.category} to ${category}`,
        user: user?.email || 'Unknown',
        timestamp: serverTimestamp(),
        memberName: member.name,
        oldCategory: member.category,
        newCategory: category,
      });

      setEditingMember(null);
      setNewCategory('');
      alert(`Successfully updated ${member.name}'s category to ${category}.`);
      await fetchMembers();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Error updating category. Please try again.');
    }
  };

  const handleNameChange = async (member, newName) => {
    if (!newName || !newName.trim()) { alert('Please enter a valid name.'); return; }
    const trimmedNewName = newName.trim();

    const isDuplicate = members.some(m =>
      normalizeName(m.name) === normalizeName(trimmedNewName) &&
      normalizeName(m.name) !== normalizeName(member.name)
    );
    if (isDuplicate) { alert('A member with this name already exists.'); return; }

    try {
      const attendanceSnapshot = await getDocs(query(collection(db, 'attendance')));
      const membershipSnapshot = await getDocs(query(collection(db, 'membership')));

      const matchingMembershipDocs = membershipSnapshot.docs.filter(d =>
        normalizeName(d.data().name) === normalizeName(member.name)
      );
      for (const membershipDoc of matchingMembershipDocs) {
        await updateDoc(doc(db, 'membership', membershipDoc.id), { name: trimmedNewName });
      }

      const matchingAttendanceDocs = attendanceSnapshot.docs.filter(d =>
        normalizeName(d.data().name) === normalizeName(member.name)
      );
      for (const attendanceDoc of matchingAttendanceDocs) {
        await updateDoc(doc(db, 'attendance', attendanceDoc.id), { name: trimmedNewName });
      }

      await addDoc(collection(db, 'logs'), {
        action: 'Name Change',
        details: `Changed member name from ${member.name} to ${trimmedNewName}`,
        user: user?.email || 'Unknown',
        timestamp: serverTimestamp(),
        memberName: trimmedNewName,
        oldName: member.name,
        newName: trimmedNewName,
      });

      setEditingName(null);
      setNewName('');
      alert(`Successfully updated member name to "${trimmedNewName}".`);
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
      const membersToUpdate = members.filter(m => m.category === bulkFromCategory);
      if (membersToUpdate.length === 0) {
        alert(`No members found in ${bulkFromCategory} category.`);
        return;
      }

      const confirmUpdate = window.confirm(
        `This will update ${membersToUpdate.length} members from ${bulkFromCategory} to ${bulkToCategory}. Continue?`
      );
      if (!confirmUpdate) return;

      const attendanceSnapshot = await getDocs(query(collection(db, 'attendance')));
      const membershipSnapshot = await getDocs(query(collection(db, 'membership')));

      let updatedCount = 0;
      for (const member of membersToUpdate) {
        const matchingMembershipDocs = membershipSnapshot.docs.filter(d =>
          normalizeName(d.data().name) === normalizeName(member.name)
        );
        for (const membershipDoc of matchingMembershipDocs) {
          await updateDoc(doc(db, 'membership', membershipDoc.id), { category: bulkToCategory });
        }

        const matchingAttendanceDocs = attendanceSnapshot.docs.filter(d =>
          normalizeName(d.data().name) === normalizeName(member.name)
        );
        for (const attendanceDoc of matchingAttendanceDocs) {
          await updateDoc(doc(db, 'attendance', attendanceDoc.id), { category: bulkToCategory });
        }

        await addDoc(collection(db, 'logs'), {
          action: 'Bulk Category Update',
          details: `Bulk updated ${member.name}'s category from ${bulkFromCategory} to ${bulkToCategory}`,
          user: user?.email || 'Unknown',
          timestamp: serverTimestamp(),
          memberName: member.name,
          oldCategory: bulkFromCategory,
          newCategory: bulkToCategory,
        });
        updatedCount++;
      }

      setBulkFromCategory('');
      setBulkToCategory('');
      alert(`Successfully updated ${updatedCount} members from ${bulkFromCategory} to ${bulkToCategory}.`);
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
      if (sortBy === 'name') { aValue = aValue.toLowerCase(); bValue = bValue.toLowerCase(); }
      if (sortOrder === 'asc') return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      else return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    });

  const filteredStreaks = streaks
    .filter(s => {
      const matchCat = streakFilter === 'All' || s.category === streakFilter;
      const matchSearch = s.name.toLowerCase().includes(streakSearch.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => b[streakSortBy] - a[streakSortBy]);

  const exportStreaks = (format) => {
    if (filteredStreaks.length === 0) {
      alert('No streak data to export.');
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    const categoryLabel = streakFilter !== 'All' ? `_${streakFilter}` : '';
    const filename = `Streaks${categoryLabel}_${date}`;

    if (format === 'csv') {
      const header = 'Rank,Name,Category,Current Streak,Longest Streak,Total Attended\n';
      const rows = filteredStreaks.map((s, i) =>
        `${i + 1},"${s.name}",${s.category},${s.currentStreak},${s.longestStreak},${s.totalAttended}`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Plain text / tab-separated for clipboard / Excel paste
      const header = 'Rank\tName\tCategory\tCurrent Streak\tLongest Streak\tTotal Attended\n';
      const rows = filteredStreaks.map((s, i) =>
        `${i + 1}\t${s.name}\t${s.category}\t${s.currentStreak}\t${s.longestStreak}\t${s.totalAttended}`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const streakMedal = (rank) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `${rank + 1}.`;
  };

  const streakFlame = (streak) => {
    if (streak >= 10) return '🔥🔥🔥';
    if (streak >= 5) return '🔥🔥';
    if (streak >= 2) return '🔥';
    return '';
  };

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
          <div className="page-header-clean">
            <h1>Membership Management</h1>
            <p>Manage church members and their categories</p>
          </div>

          {!isAdmin() && (
            <div className="info-banner">
              <span>ℹ️ You have view-only access. Contact an admin to edit member information or perform bulk updates.</span>
            </div>
          )}

          {/* Tabs */}
          <div className="attendance-tabs">
            <button
              className={`tab-btn ${activeTab === 'members' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
            <button
              className={`tab-btn ${activeTab === 'streaks' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('streaks')}
            >
              Streaks
            </button>
          </div>

          {/* ── MEMBERS TAB ── */}
          {activeTab === 'members' && (
            <>
              {/* Controls Card */}
              <div className="controls-card">
                <div className="controls-header">
                  <h3>Search & Filter</h3>
                  <button onClick={fetchMembers} className="refresh-btn-small">Refresh</button>
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
                      <select value={bulkFromCategory} onChange={(e) => setBulkFromCategory(e.target.value)} className="select-clean">
                        <option value="">Select source category...</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="bulk-select-group">
                      <label>To Category</label>
                      <select value={bulkToCategory} onChange={(e) => setBulkToCategory(e.target.value)} className="select-clean">
                        <option value="">Select target category...</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="bulk-actions">
                      <button onClick={handleBulkCategoryUpdate} disabled={!bulkFromCategory || !bulkToCategory} className="btn-primary">
                        Bulk Update
                      </button>
                      <button onClick={() => { setBulkFromCategory(''); setBulkToCategory(''); }} className="btn-secondary">
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </AdminOnly>

              {/* Statistics Card */}
              <div className="stats-card">
                <div className="stats-header"><h3>Membership Statistics</h3></div>
                <div className="stats-grid">
                  <div className="stat-item total">
                    <div className="stat-label">Total Members</div>
                    <div className="stat-value">{filteredAndSortedMembers.length}</div>
                  </div>
                  {categories.map(category => (
                    <div key={category} className="stat-item">
                      <div className="stat-label">{category}</div>
                      <div className="stat-value">{filteredAndSortedMembers.filter(m => m.category === category).length}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Members Table */}
              <div className="table-card">
                <div className="table-header">
                  <h3>Members List</h3>
                  <div className="table-info">Showing {filteredAndSortedMembers.length} members</div>
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
                                <button onClick={() => handleNameChange(member, newName)} disabled={!newName.trim()} className="save-btn">Save</button>
                                <button onClick={() => { setEditingName(null); setNewName(''); }} className="cancel-btn">Cancel</button>
                              </div>
                            ) : (
                              <div className="name-display">
                                <span>{member.name}</span>
                                <AdminOnly>
                                  <button
                                    onClick={() => { setEditingName(member.name); setNewName(member.name); }}
                                    className="edit-name-btn"
                                    title="Edit name (Admin only)"
                                  >✏️</button>
                                </AdminOnly>
                              </div>
                            )}
                          </td>
                          <td className="member-category">
                            {editingMember === member.name ? (
                              <div className="edit-category-controls">
                                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="select-clean">
                                  <option value="">Select category...</option>
                                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <button onClick={() => handleCategoryChange(member, newCategory)} disabled={!newCategory} className="save-btn">Save</button>
                                <button onClick={() => { setEditingMember(null); setNewCategory(''); }} className="cancel-btn">Cancel</button>
                              </div>
                            ) : (
                              <span className={`category-badge category-${member.category.toLowerCase()}`}>{member.category}</span>
                            )}
                          </td>
                          <td className="member-actions">
                            {editingMember !== member.name && (
                              <AdminOnly>
                                <button
                                  onClick={() => { setEditingMember(member.name); setNewCategory(member.category); }}
                                  className="btn-edit"
                                >Edit</button>
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
                  <div className="no-members-card"><p>No members found matching your criteria.</p></div>
                )}
              </div>
            </>
          )}

          {/* ── STREAKS TAB ── */}
          {activeTab === 'streaks' && (
            <div className="streaks-container">
              <div className="controls-card">
                <div className="controls-header">
                  <h3>Attendance Streaks</h3>
                  <button onClick={fetchStreaks} className="refresh-btn-small" disabled={streaksLoading}>
                    {streaksLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)', margin: '0 0 1rem' }}>
                  A streak counts consecutive service dates attended. Missing a service resets the current streak.
                </p>
                <div className="controls-grid">
                  <div className="control-group">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={streakSearch}
                      onChange={(e) => setStreakSearch(e.target.value)}
                      className="search-input-clean"
                    />
                  </div>
                  <div className="control-group">
                    <label>Filter by Category</label>
                    <select value={streakFilter} onChange={(e) => setStreakFilter(e.target.value)} className="select-clean">
                      <option value="All">All Categories</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label>Sort By</label>
                    <select value={streakSortBy} onChange={(e) => setStreakSortBy(e.target.value)} className="select-clean">
                      <option value="currentStreak">Current Streak</option>
                      <option value="longestStreak">Longest Streak</option>
                      <option value="totalAttended">Total Attended</option>
                    </select>
                  </div>
                </div>
              </div>

              {streaksLoading ? (
                <div className="loading-spinner"><div className="spinner"></div><p>Computing streaks...</p></div>
              ) : (
                <div className="table-card">
                  <div className="table-header">
                    <h3>Streak Leaderboard</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="table-info">{filteredStreaks.length} members</span>
                      <button onClick={() => exportStreaks('csv')} className="refresh-btn-small">
                        Export CSV
                      </button>
                    </div>
                  </div>
                  <div className="table-container-clean">
                    <table className="members-table-clean">
                      <thead>
                        <tr>
                          <th style={{ width: '3rem' }}>#</th>
                          <th className="name-col">Member</th>
                          <th className="category-col">Category</th>
                          <th style={{ textAlign: 'center' }}>Current Streak</th>
                          <th style={{ textAlign: 'center' }}>Longest Streak</th>
                          <th style={{ textAlign: 'center' }}>Total Attended</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStreaks.map((s, i) => (
                          <tr key={s.name} className={i < 3 ? 'streak-top-row' : ''}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{streakMedal(i)}</td>
                            <td className="member-name">
                              <div className="name-display">
                                <span>{s.name}</span>
                              </div>
                            </td>
                            <td className="member-category">
                              <span className={`category-badge category-${s.category?.toLowerCase()}`}>{s.category}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="streak-value">
                                {s.currentStreak} {streakFlame(s.currentStreak)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="streak-best">{s.longestStreak}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>{s.totalAttended}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredStreaks.length === 0 && (
                    <div className="no-members-card"><p>No streak data found.</p></div>
                  )}
                </div>
              )}
            </div>
          )}

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
