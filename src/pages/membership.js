import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useAuth } from '../context/authContext';
import { AdminOnly } from '../components/RoleBasedAccess';
import Navigation from '../components/Navigation';
import { getServiceType } from '../utils/serviceType';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';

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


  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('All');
  const [bulkFromCategory, setBulkFromCategory] = useState('');
  const [bulkToCategory, setBulkToCategory] = useState('');
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Add member state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // CSV import state
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Streak state
  const [streaks, setStreaks] = useState([]);
  const [streaksLoading, setStreaksLoading] = useState(false);
  const [streakSortBy, setStreakSortBy] = useState('sundayCurrent');
  const [streakSortDir, setStreakSortDir] = useState('desc');
  const [streakFilter, setStreakFilter] = useState('All');
  const [streakSearch, setStreakSearch] = useState('');

  const toggleStreakSort = (field) => {
    if (streakSortBy === field) {
      setStreakSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setStreakSortBy(field);
      setStreakSortDir('desc');
    }
  };

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

      // Build per-service-type sets: Sunday dates, Monday dates, member attendance per type
      const sundayDatesSet = new Set();
      const mondayDatesSet = new Set();
      // key -> { name, category, sundayDates: Set, mondayDates: Set }
      const memberAttendance = new Map();

      snap.docs.forEach(d => {
        const data = d.data();
        const { name, category, date } = data;
        if (!name || !date) return;
        const type = getServiceType(data);
        if (type === 'Sunday') sundayDatesSet.add(date);
        else if (type === 'Monday') mondayDatesSet.add(date);

        const key = normalizeName(name);
        if (!memberAttendance.has(key)) {
          memberAttendance.set(key, {
            name: name.trim(),
            category,
            sundayDates: new Set(),
            mondayDates: new Set(),
          });
        }
        const entry = memberAttendance.get(key);
        if (type === 'Sunday') entry.sundayDates.add(date);
        else if (type === 'Monday') entry.mondayDates.add(date);
      });

      const sundayDatesSorted = Array.from(sundayDatesSet).sort();
      const mondayDatesSorted = Array.from(mondayDatesSet).sort();

      const streakData = Array.from(memberAttendance.values()).map(({ name, category, sundayDates, mondayDates }) => {
        const sun = computeStreaks(sundayDatesSorted, sundayDates);
        const mon = computeStreaks(mondayDatesSorted, mondayDates);
        // Use the better of the two as the "current/longest" for sorting convenience
        const currentStreak = Math.max(sun.currentStreak, mon.currentStreak);
        const longestStreak = Math.max(sun.longestStreak, mon.longestStreak);
        return {
          name,
          category,
          currentStreak,
          longestStreak,
          sundayCurrent: sun.currentStreak,
          sundayLongest: sun.longestStreak,
          mondayCurrent: mon.currentStreak,
          mondayLongest: mon.longestStreak,
          totalAttended: sundayDates.size + mondayDates.size,
        };
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

  const handleAddMember = async () => {
    const trimmed = addName.trim();
    if (!trimmed || !addCategory) { alert('Please enter a name and select a category.'); return; }
    const isDuplicate = members.some(m => normalizeName(m.name) === normalizeName(trimmed));
    if (isDuplicate) { alert('A member with this name already exists.'); return; }
    setAddLoading(true);
    try {
      await addDoc(collection(db, 'membership'), { name: trimmed, category: addCategory });
      await addDoc(collection(db, 'logs'), {
        action: 'Member Added',
        details: `Added new member: ${trimmed} (${addCategory})`,
        user: user?.email || 'Unknown',
        timestamp: serverTimestamp(),
        memberName: trimmed,
      });
      setAddName('');
      setAddCategory('');
      setShowAddForm(false);
      await fetchMembers();
    } catch (err) {
      console.error('Error adding member:', err);
      alert('Failed to add member.');
    } finally {
      setAddLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'name,category\nJohn Doe,L100\nJane Smith,L200\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'members_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setImportLoading(true);
      setImportResult(null);
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { alert('CSV file is empty or has no data rows.'); return; }

        // Parse header
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        const nameIdx = header.indexOf('name');
        const catIdx = header.indexOf('category');
        if (nameIdx === -1) { alert('CSV must have a "name" column.'); return; }

        const existingNames = new Set(members.map(m => normalizeName(m.name)));
        let added = 0, skipped = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const name = cols[nameIdx]?.trim();
          const category = catIdx !== -1 ? cols[catIdx]?.trim() : '';
          if (!name) continue;

          if (existingNames.has(normalizeName(name))) { skipped++; continue; }

          const validCat = categories.includes(category) ? category : 'New';
          await addDoc(collection(db, 'membership'), { name, category: validCat });
          existingNames.add(normalizeName(name));
          added++;
        }

        await addDoc(collection(db, 'logs'), {
          action: 'CSV Import',
          details: `Imported ${added} members from CSV (${skipped} duplicates skipped)`,
          user: user?.email || 'Unknown',
          timestamp: serverTimestamp(),
        });

        setImportResult({ added, skipped });
        setTimeout(() => setImportResult(null), 6000);
        await fetchMembers();
      } catch (err) {
        console.error('Error importing CSV:', err);
        alert('Failed to import CSV.');
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Filtered data for TanStack table
  const filteredMembers = useMemo(() => {
    if (filterCategory === 'All') return members;
    return members.filter(m => m.category === filterCategory);
  }, [members, filterCategory]);

  // Editable cell for name
  const EditableNameCell = ({ getValue, row }) => {
    const initialValue = getValue();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(initialValue);

    if (!isAdmin()) return <span>{initialValue}</span>;

    if (editing) {
      return (
        <input
          className="cell-edit-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (value.trim() && value.trim() !== initialValue) {
              handleNameChange(row.original, value.trim());
            }
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (value.trim() && value.trim() !== initialValue) {
                handleNameChange(row.original, value.trim());
              }
              setEditing(false);
            }
            if (e.key === 'Escape') { setValue(initialValue); setEditing(false); }
          }}
          autoFocus
        />
      );
    }
    return (
      <span className="cell-editable" onClick={() => { setValue(initialValue); setEditing(true); }}>
        {initialValue}
      </span>
    );
  };

  // Editable cell for category
  const EditableCategoryCell = ({ getValue, row }) => {
    const initialValue = getValue();
    const [editing, setEditing] = useState(false);

    if (!isAdmin()) {
      return <span className={`category-badge category-${initialValue?.toLowerCase()}`}>{initialValue}</span>;
    }

    if (editing) {
      return (
        <select
          className="cell-edit-select"
          defaultValue={initialValue}
          onChange={(e) => {
            if (e.target.value !== initialValue) {
              handleCategoryChange(row.original, e.target.value);
            }
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          autoFocus
        >
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      );
    }
    return (
      <span
        className={`category-badge category-${initialValue?.toLowerCase()} cell-editable`}
        onClick={() => setEditing(true)}
      >
        {initialValue}
      </span>
    );
  };

  // TanStack columns
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Member Name',
      cell: (props) => <EditableNameCell {...props} />,
      size: 250,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: (props) => <EditableCategoryCell {...props} />,
      size: 140,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [members, isAdmin]);

  const table = useReactTable({
    data: filteredMembers,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  });

  const filteredStreaks = streaks
    .filter(s => {
      const matchCat = streakFilter === 'All' || s.category === streakFilter;
      const matchSearch = s.name.toLowerCase().includes(streakSearch.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      const av = a[streakSortBy] || 0;
      const bv = b[streakSortBy] || 0;
      return streakSortDir === 'desc' ? bv - av : av - bv;
    });

  const exportStreaks = (format) => {
    if (filteredStreaks.length === 0) {
      alert('No streak data to export.');
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    const categoryLabel = streakFilter !== 'All' ? `_${streakFilter}` : '';
    const filename = `Streaks${categoryLabel}_${date}`;

    if (format === 'csv') {
      const header = 'Rank,Name,Category,Current,Longest,Sun Current,Sun Longest,Mon Current,Mon Longest,Total\n';
      const rows = filteredStreaks.map((s, i) =>
        `${i + 1},"${s.name}",${s.category},${s.currentStreak},${s.longestStreak},${s.sundayCurrent ?? 0},${s.sundayLongest ?? 0},${s.mondayCurrent ?? 0},${s.mondayLongest ?? 0},${s.totalAttended}`
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
              {/* Add Member / Import toolbar — Admin Only */}
              <AdminOnly>
                <div className="member-toolbar">
                  <div className="toolbar-buttons">
                    <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                      {showAddForm ? '— Cancel' : '+ Add Member'}
                    </button>
                    <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
                      Import CSV
                    </button>
                  </div>
                  {importResult && (
                    <div className="success-banner" style={{ marginTop: '0.75rem' }}>
                      <span>Imported {importResult.added} members. {importResult.skipped > 0 ? `${importResult.skipped} duplicates skipped.` : ''}</span>
                      <button onClick={() => setImportResult(null)} className="success-close">×</button>
                    </div>
                  )}
                  {showAddForm && (
                    <div className="add-member-form">
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Member name..."
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select className="form-select" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                          <option value="">Select category...</option>
                          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <button className="btn-primary" onClick={handleAddMember} disabled={addLoading || !addName.trim() || !addCategory}>
                        {addLoading ? 'Adding...' : 'Add Member'}
                      </button>
                    </div>
                  )}
                </div>
              </AdminOnly>

              {/* Import CSV Modal */}
              {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2>Import Members</h2>
                    </div>
                    <div className="modal-body">
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                        Upload a CSV file with <strong>name</strong> and <strong>category</strong> columns. Duplicate names will be skipped automatically.
                      </p>
                      <div className="import-modal-actions">
                        <button className="btn-secondary" onClick={() => { downloadTemplate(); }}>
                          Download Template
                        </button>
                        <label className="btn-primary import-file-btn">
                          {importLoading ? 'Importing...' : 'Select CSV File'}
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => { handleCSVImport(e); setShowImportModal(false); }}
                            hidden
                            disabled={importLoading}
                          />
                        </label>
                      </div>
                      <div style={{ marginTop: '1.25rem', padding: '0.875rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Template format:</strong><br />
                        name,category<br />
                        John Doe,L100<br />
                        Jane Smith,L200
                      </div>
                    </div>
                    <div className="modal-buttons" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
                      <button className="btn-secondary" onClick={() => setShowImportModal(false)}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search & Filter Bar */}
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
                      value={globalFilter ?? ''}
                      onChange={(e) => setGlobalFilter(e.target.value)}
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
                    <div className="stat-value">{table.getRowModel().rows.length}</div>
                  </div>
                  {categories.map(category => (
                    <div key={category} className="stat-item">
                      <div className="stat-label">{category}</div>
                      <div className="stat-value">{filteredMembers.filter(m => m.category === category).length}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TanStack Members Table */}
              <div className="table-card">
                <div className="table-header">
                  <h3>Members List</h3>
                  <div className="table-info">
                    {table.getRowModel().rows.length} members
                    {isAdmin() && <span className="edit-hint"> — click any cell to edit</span>}
                  </div>
                </div>
                <div className="table-container-clean">
                  <table className="members-table-clean tanstack-table">
                    <thead>
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                          <th style={{ width: 50, textAlign: 'center' }}>#</th>
                          {headerGroup.headers.map(header => (
                            <th
                              key={header.id}
                              onClick={header.column.getToggleSortingHandler()}
                              className={header.column.getCanSort() ? 'sortable-header' : ''}
                              style={{ width: header.getSize() }}
                            >
                              <span className="th-content">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() === 'asc' ? ' ▲' :
                                 header.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                              </span>
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 1 ? 'row-striped' : ''}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.getRowModel().rows.length === 0 && (
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
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
                  Tip: click any streak column header to sort.
                </p>
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
                    <table className="members-table-clean streaks-table">
                      <thead>
                        <tr>
                          <th style={{ width: '3rem', textAlign: 'center' }}>#</th>
                          <th className="name-col">Member</th>
                          <th className="category-col">Category</th>
                          <th colSpan="2" className="streak-group-header sunday-group">Sunday</th>
                          <th colSpan="2" className="streak-group-header monday-group">Monday</th>
                          <th
                            className={`sortable-header ${streakSortBy === 'totalAttended' ? 'sorted-active' : ''}`}
                            style={{ textAlign: 'center', cursor: 'pointer' }}
                            rowSpan="2"
                            onClick={() => toggleStreakSort('totalAttended')}
                          >
                            Total
                            {streakSortBy === 'totalAttended' && (
                              <span style={{ marginLeft: '0.25rem', color: 'var(--accent)' }}>
                                {streakSortDir === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </th>
                        </tr>
                        <tr className="streak-subheader">
                          <th></th>
                          <th></th>
                          <th></th>
                          {[
                            { field: 'sundayCurrent',  label: 'Current' },
                            { field: 'sundayLongest',  label: 'Longest' },
                            { field: 'mondayCurrent',  label: 'Current' },
                            { field: 'mondayLongest',  label: 'Longest' },
                          ].map(col => (
                            <th
                              key={col.field}
                              className={`sortable-header ${streakSortBy === col.field ? 'sorted-active' : ''}`}
                              style={{ textAlign: 'center', cursor: 'pointer' }}
                              onClick={() => toggleStreakSort(col.field)}
                            >
                              {col.label}
                              {streakSortBy === col.field && (
                                <span style={{ marginLeft: '0.25rem', color: 'var(--accent)' }}>
                                  {streakSortDir === 'desc' ? '▼' : '▲'}
                                </span>
                              )}
                            </th>
                          ))}
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
                                {s.sundayCurrent} {streakFlame(s.sundayCurrent)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="streak-best">{s.sundayLongest}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="streak-value">
                                {s.mondayCurrent} {streakFlame(s.mondayCurrent)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="streak-best">{s.mondayLongest}</span>
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

        </div>
      </div>
    </>
  );
};

export default Membership;
