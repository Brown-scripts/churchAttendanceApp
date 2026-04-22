import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

/**
 * Accessible searchable dropdown (combobox pattern).
 *
 * Props:
 * - value: string
 * - onChange: (string) => void
 * - options: string[] OR Array<{ value, label, sub? }>
 * - placeholder?: string
 * - allowFreeText?: boolean — if true, the user can type values not in the list
 * - emptyText?: string — shown when no options match the query
 * - id?: string
 * - required?: boolean
 * - disabled?: boolean
 */
export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  allowFreeText = false,
  emptyText = "No matches",
  id,
  required = false,
  disabled = false,
}) {
  const generatedId = useId();
  const controlId = id || `combobox-${generatedId}`;
  const listboxId = `${controlId}-listbox`;

  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to objects
  const normalized = useMemo(
    () => options.map(o => typeof o === "string" ? { value: o, label: o } : o),
    [options]
  );

  // Keep input text in sync when parent value changes externally
  useEffect(() => {
    if (value !== query) setQuery(value || "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter against query
  const filtered = useMemo(() => {
    if (!query || query === value) return normalized;
    const q = query.toLowerCase();
    return normalized.filter(o => o.label.toLowerCase().includes(q));
  }, [query, normalized, value]);

  // Clamp active index
  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1));
  }, [filtered, active]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
        // If free-text isn't allowed, restore the last committed value
        if (!allowFreeText && value) setQuery(value);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, value, allowFreeText]);

  // Scroll active option into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${active}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (val) => {
    onChange(val);
    setQuery(val);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    setActive(0);
    if (allowFreeText) onChange(v);
  };

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive(a => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        commit(filtered[active].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      if (!allowFreeText && value) setQuery(value);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const clear = (e) => {
    e.stopPropagation();
    setQuery("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div
      ref={wrapRef}
      className={`combobox${open ? " combobox-open" : ""}${disabled ? " combobox-disabled" : ""}`}
    >
      <div className="combobox-control">
        <input
          ref={inputRef}
          id={controlId}
          type="text"
          className="combobox-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filtered[active] ? `${controlId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          disabled={disabled}
        />
        {query && !disabled && (
          <button
            type="button"
            className="combobox-clear"
            onClick={clear}
            aria-label="Clear selection"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} className="combobox-chevron" aria-hidden="true" />
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="combobox-listbox"
        >
          {filtered.length === 0 ? (
            <li className="combobox-empty">{emptyText}</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={`${controlId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                className={`combobox-option${i === active ? " combobox-option-active" : ""}${opt.value === value ? " combobox-option-selected" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); commit(opt.value); }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="combobox-option-label">{opt.label}</span>
                {opt.sub && <span className="combobox-option-sub">{opt.sub}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
