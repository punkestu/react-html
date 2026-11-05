import React, { ReactNode } from 'react';

export interface CardProps {
  title: string;
  children: ReactNode;
  icon?: string;
}

export function Card({ title, children, icon }: CardProps) {
  return (
    <div className="card">
      <h3>{icon ? `${icon} ` : ''}{title}</h3>
      <div>{children}</div>
    </div>
  );
}

