import { useEffect, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Module-level cache shared across every component that mounts the hook.
// Keyed by collection name. Entries: { data, fetchedAt, inflight }.
const cache = new Map();
const subscribers = new Map();

const TTL_MS = 5 * 60 * 1000;

const notify = (name) => {
  const subs = subscribers.get(name);
  if (subs) subs.forEach((fn) => fn());
};

export const invalidateCollection = (name) => {
  cache.delete(name);
  notify(name);
};

const isFresh = (entry) => entry && Date.now() - entry.fetchedAt < TTL_MS;

const fetchOnce = (name) => {
  const entry = cache.get(name);
  if (isFresh(entry)) return entry.data;
  if (entry?.inflight) return entry.inflight;

  const inflight = getDocs(collection(db, name))
    .then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cache.set(name, { data, fetchedAt: Date.now(), inflight: null });
      notify(name);
      return data;
    })
    .catch((err) => {
      cache.set(name, { ...(cache.get(name) || {}), inflight: null });
      throw err;
    });

  cache.set(name, { ...(entry || {}), inflight });
  return inflight;
};

export function useFirestoreCollection(name) {
  const [state, setState] = useState(() => {
    const entry = cache.get(name);
    if (isFresh(entry)) return { data: entry.data, loading: false, error: null };
    return { data: null, loading: true, error: null };
  });

  const load = useCallback(() => {
    const entry = cache.get(name);
    if (isFresh(entry)) {
      setState({ data: entry.data, loading: false, error: null });
      return;
    }
    setState((s) => ({ data: s.data, loading: true, error: null }));
    Promise.resolve(fetchOnce(name))
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err }));
  }, [name]);

  useEffect(() => {
    if (!subscribers.has(name)) subscribers.set(name, new Set());
    subscribers.get(name).add(load);
    load();
    return () => {
      subscribers.get(name)?.delete(load);
    };
  }, [name, load]);

  return { ...state, refresh: load };
}

export const useAttendanceRecords = () => useFirestoreCollection("attendance");
export const useMembers = () => useFirestoreCollection("membership");
