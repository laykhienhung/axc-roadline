import type { ReactNode } from 'react';
import { Brand } from './app-header';

export function AuthCard({
  title,
  intro,
  notice,
  foot,
  children,
}: {
  title: string;
  intro: ReactNode;
  notice?: ReactNode;
  foot: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="auth">
      <section className="card auth-card">
        <Brand />
        <h2>{title}</h2>
        <p className="intro">{intro}</p>
        {notice}
        {children}
        <div className="foot">{foot}</div>
      </section>
    </main>
  );
}
