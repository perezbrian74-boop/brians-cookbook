import React from "react";

/**
 * Pick 1 of N as a row of pills (NYLA §8.2: role="radiogroup" + radios).
 * Roving tabindex: Tab enters the group once, arrow keys move and select.
 */
export default function RadioPills({ label, options, value, onChange, className = "" }) {
  const refs = React.useRef([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e) {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (dir) next = (idx + dir + options.length) % options.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    if (next == null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={"cb-pills " + className} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={"cb-pill" + (on ? " is-on" : "")}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.count != null && <span className="cb-pill__count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
