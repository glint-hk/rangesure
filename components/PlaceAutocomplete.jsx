'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// Search-as-you-type place suggestions, shared by DriverView's origin/destination
// inputs and ChargingView's city search. Controlled: the caller owns the text value
// (value/onChange) — this component only adds the debounced dropdown on top of it.
export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  onEnter,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestId = useRef(0);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  // Only fetch/open when the value change came from the user actually typing in THIS
  // input — not from a preset button or another component setting the value directly
  // (e.g. applyPreset), which should just fill the field quietly.
  const isUserEdit = useRef(false);

  const handleInputChange = (e) => {
    isUserEdit.current = true;
    onChange(e.target.value);
  };

  useEffect(() => {
    const query = (value || '').trim();
    clearTimeout(debounceRef.current);

    if (!isUserEdit.current) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    isUserEdit.current = false;

    if (query.length < MIN_QUERY_LENGTH) {
      requestId.current += 1; // invalidate any in-flight request
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const id = ++requestId.current;
      try {
        const res = await fetch('/api/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (id !== requestId.current) return; // superseded by a newer keystroke
        setSuggestions(data.suggestions || []);
        setOpen((data.suggestions || []).length > 0);
        setActiveIndex(-1);
      } catch {
        if (id === requestId.current) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (label) => {
    // Goes through onChange directly (not handleInputChange), so isUserEdit stays
    // false and the resulting value-change effect won't re-open the dropdown.
    onChange(label);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex].label);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Enter') onEnter?.();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        value={value}
        onChange={handleInputChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-60 w-full min-w-[240px] overflow-auto rounded-xl border border-border bg-surface py-1 shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s.label)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-raised',
                  i === activeIndex && 'bg-surface-raised'
                )}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
