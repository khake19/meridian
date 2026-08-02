import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function PrimaryButton(props: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button {...props} />;
}
