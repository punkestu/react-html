import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer>
      <div className="container">
        <p>&copy; {currentYear} react-html. Modular pure HTML engine with selective reactive islands.</p>
      </div>
    </footer>
  );
}

