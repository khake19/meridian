interface MenuCheckIconProps {
  checked: boolean;
}

export function MenuCheckIcon({ checked }: MenuCheckIconProps) {
  return (
    <span className={`menu-check-icon${checked ? ' checked' : ''}`} aria-hidden="true">
      {checked && (
        <svg viewBox="0 0 16 16">
          <path d="m3.5 8.25 2.75 2.75 6.25-6.25" />
        </svg>
      )}
    </span>
  );
}
