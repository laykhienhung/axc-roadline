// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '../src/shared/model';
import { nextActions } from '../src/shared/next-actions';
import { DEC_TODAY, decPlan, fixturePlan, fixturePlanV21, fixturePlanV42 } from './helpers';
import { mockFetch, renderApp } from './render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const timeline = () => screen.getByLabelText('Timeline');
const stop = (key: string) =>
  timeline().querySelector(`button[data-station="${key}"]`) as HTMLButtonElement;
const tree = (label: string) => screen.getByLabelText(`${label} actions`);
/** The folder row whose label starts with `text` (rows also hold tree lines and [+]). */
const folder = (scope: HTMLElement, text: string) =>
  [...scope.querySelectorAll<HTMLButtonElement>('.tt-row.folder')].find((b) =>
    b.querySelector('.lbl')!.textContent!.startsWith(text)
  )!;
const leaf = (targetId: string, no: number) =>
  timeline().querySelector(`[data-action="${targetId}-${no}"]`) as HTMLButtonElement;

/** Open target → its first section in a quarter's tree; returns that section's action numbers. */
function openFirstSection(plan: Plan, label: string, targetId: string): number[] {
  const t = plan.targets.find((x) => x.id === targetId)!;
  const inQ = t.actions.filter((a) => a.quarter === label);
  fireEvent.click(folder(tree(label), `${targetId} `));
  fireEvent.click(folder(tree(label), inQ[0].section || 'Actions'));
  return inQ.filter((a) => a.section === inQ[0].section).map((a) => a.no);
}

describe('timeline page', () => {
  it('shows the quarters horizontally with the current one open', async () => {
    mockFetch(fixturePlan());
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    expect(screen.getByRole('button', { name: 'Import workbook' })).toBeTruthy();
    expect(screen.getByRole('banner').textContent).toContain(
      'Sep 2026 – Aug 2027 · from axc-fy2026-27.xlsx · updated'
    );
    expect(screen.getByRole('button', { name: '◀▶ Horizontal' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    const keys = [...timeline().querySelectorAll('button[data-station]')].map((b) =>
      b.getAttribute('data-station')
    );
    expect(keys).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'ongoing']);
    expect(stop('Q1').textContent).toContain('NOW');
    expect(stop('Q1').getAttribute('aria-expanded')).toBe('true');
    expect(stop('Q2').getAttribute('aria-expanded')).toBe('false');
    expect(stop('Q2').textContent).toContain('Dec 2026 – Feb 2027');
    // Q1 open: one folder per target with Q1 actions, all collapsed
    expect(tree('Q1').querySelectorAll('.tt-row.folder')).toHaveLength(4);
    expect(tree('Q1').querySelectorAll('.tt-row.leaf')).toHaveLength(0);
  });

  it('shows year progress and overdue in the timeline header', async () => {
    mockFetch(fixturePlan());
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    expect(screen.getByLabelText('Year progress 0%').textContent).toContain('0/75 done');
    expect(timeline().querySelector('.tt-h')!.textContent).toContain('0 overdue');
  });

  it('shows the Dec plan figures and flags late actions', async () => {
    const plan = decPlan();
    mockFetch(plan);
    renderApp('/?today=2026-12-10');
    await screen.findByLabelText('Timeline');
    expect(screen.getByLabelText('Year progress 19%')).toBeTruthy();
    expect(timeline().querySelector('.tt-h')!.textContent).toContain('6 overdue');
    expect(stop('Q2').getAttribute('aria-expanded')).toBe('true');
    expect(stop('Q1').textContent).toContain('late');
    fireEvent.click(stop('Q1'));
    const nos = openFirstSection(plan, 'Q1', 'T1');
    expect(nos.length).toBeGreaterThan(0);
    const lateRows = nos.map((n) => leaf('T1', n)).filter((b) => b.querySelector('.side.late'));
    expect(lateRows.length).toBeGreaterThan(0);
    expect(lateRows.every((b) => b.querySelector('.sq.bg-behind'))).toBe(true);
  });

  it('opens target and section folders down to the actions', async () => {
    const plan = fixturePlan();
    mockFetch(plan);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    const t1 = folder(tree('Q1'), 'T1 ');
    expect(t1.getAttribute('aria-expanded')).toBe('false');
    const nos = openFirstSection(plan, 'Q1', 'T1');
    expect(t1.getAttribute('aria-expanded')).toBe('true');
    expect(tree('Q1').querySelectorAll('.tt-row.leaf')).toHaveLength(nos.length);
    fireEvent.click(t1);
    expect(tree('Q1').querySelectorAll('.tt-row.leaf')).toHaveLength(0);
  });

  it('opens an action in the drawer and closes it with Escape', async () => {
    const plan = fixturePlan();
    mockFetch(plan);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    const [no] = openFirstSection(plan, 'Q1', 'T1');
    const action = plan.targets[0].actions.find((a) => a.no === no)!;
    fireEvent.click(leaf('T1', no));
    const drawer = screen.getByRole('dialog', { name: 'Action detail' });
    expect(within(drawer).getByRole('heading', { name: action.action })).toBeTruthy();
    expect(drawer.textContent).toContain(`T1-${no}`);
    expect(drawer.textContent).toContain(action.deliverable);
    expect(drawer.textContent).toContain('Q1 · Sep – Nov 2026');
    expect(
      within(drawer).getByRole('link', { name: '▶ Open target T1' }).getAttribute('href')
    ).toBe('/target/T1?today=2026-09-28');
    expect(leaf('T1', no).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Action detail' })).toBeNull();
  });

  it("lists the target's next actions in the drawer and reveals a picked one in the tree", async () => {
    const plan = decPlan();
    mockFetch(plan);
    renderApp('/?today=2026-12-10');
    await screen.findByLabelText('Timeline');
    const next = nextActions(plan, DEC_TODAY, { limit: 3, targetId: 'T1' });
    const [first, second] = next.map((n) => n.action);
    // open the top-ranked one from its own quarter's tree
    const label = first.quarter === 'ongoing' ? 'Ongoing' : first.quarter;
    if (stop(first.quarter).getAttribute('aria-expanded') !== 'true')
      fireEvent.click(stop(first.quarter));
    fireEvent.click(folder(tree(label), 'T1 '));
    fireEvent.click(folder(tree(label), first.section));
    fireEvent.click(leaf('T1', first.no));
    const drawer = screen.getByRole('dialog', { name: 'Action detail' });
    const items = () => [...drawer.querySelectorAll<HTMLButtonElement>('.drawer-next button')];
    expect(within(drawer).getByRole('heading', { name: 'Next for T1' })).toBeTruthy();
    // the same 3 as the target page, ranked, open actions only, the viewed one marked
    expect(items().map((b) => b.textContent)).toEqual(
      next.map((n) => expect.stringContaining(`#${n.action.no} ${n.action.action}`))
    );
    expect(next.every((n) => n.action.status !== 'done')).toBe(true);
    expect(drawer.querySelector('[aria-current="true"]')!.textContent).toContain(
      `#${first.no} ${first.action}◀ viewing`
    );
    // pick the second: the drawer moves to it and the tree opens down to its row
    fireEvent.click(items()[1]);
    expect(drawer.textContent).toContain(`T1-${second.no}`);
    expect(drawer.querySelector('[aria-current="true"]')!.textContent).toContain(
      `#${second.no} ${second.action}`
    );
    expect(stop(second.quarter).getAttribute('aria-expanded')).toBe('true');
    expect(leaf('T1', second.no).getAttribute('aria-pressed')).toBe('true');
  });

  it('explains the square colors in a legend', async () => {
    mockFetch(fixturePlan());
    renderApp('/?today=2026-09-28');
    const legend = await screen.findByLabelText('Status legend');
    for (const [tone, text] of [
      ['done', 'Done'],
      ['on_track', 'On track'],
      ['at_risk', 'At risk'],
      ['behind', 'Behind or overdue'],
      ['not_started', 'Not started'],
    ]) {
      const item = within(legend).getByText(text);
      expect(item.querySelector(`.sq.bg-${tone}`)).not.toBeNull();
    }
  });

  it('resizes the drawer from its handle and remembers the width', async () => {
    localStorage.clear();
    const plan = fixturePlan();
    mockFetch(plan);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    const [no] = openFirstSection(plan, 'Q1', 'T1');
    fireEvent.click(leaf('T1', no));
    const drawer = screen.getByRole('dialog', { name: 'Action detail' });
    const grip = within(drawer).getByRole('separator', { name: 'Resize detail panel' });
    expect(drawer.style.width).toBe('540px');
    fireEvent.keyDown(grip, { key: 'ArrowLeft' });
    fireEvent.keyDown(grip, { key: 'ArrowLeft' });
    expect(drawer.style.width).toBe('588px');
    expect(grip.getAttribute('aria-valuenow')).toBe('588');
    expect(document.documentElement.style.getPropertyValue('--drawer-w')).toBe('588px');
    expect(localStorage.getItem('roadline.drawerWidth')).toBe('588');
    for (let i = 0; i < 20; i++) fireEvent.keyDown(grip, { key: 'ArrowRight' });
    expect(drawer.style.width).toBe('360px'); // never narrower than the minimum
    fireEvent.doubleClick(grip);
    expect(drawer.style.width).toBe('540px');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.documentElement.style.getPropertyValue('--drawer-w')).toBe('');
  });

  it('switches to the vertical timeline', async () => {
    mockFetch(fixturePlan());
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    fireEvent.click(screen.getByRole('button', { name: '▲▼ Vertical' }));
    expect(timeline().querySelector('.tt-v-body')).not.toBeNull();
    expect(timeline().querySelectorAll('.tt-vstop')).toHaveLength(5);
    expect(stop('Q1').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(stop('Q3'));
    expect(tree('Q3')).toBeTruthy();
  });

  it('opens the target page from the drawer, scrolled to the top', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const plan = fixturePlan();
    mockFetch(plan);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    const [no] = openFirstSection(plan, 'Q1', 'T2');
    fireEvent.click(leaf('T2', no));
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('link', { name: '▶ Open target T2' }));
    expect((await screen.findByLabelText('Breadcrumb')).textContent).toContain(
      'T2 · Drive Adoption Across Teams'
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('timeline page — v2.1 plan', () => {
  it('adds a Next-year stop with one folder per target that has moved actions', async () => {
    const plan = fixturePlanV21();
    mockFetch(plan);
    renderApp('/?today=2026-09-29');
    await screen.findByLabelText('Timeline');
    const moved = plan.targets.flatMap((t) => t.actions).filter((a) => a.quarter === 'next_year');
    expect(stop('next_year').textContent).toContain('FY27-28');
    expect(stop('next_year').textContent).toContain(`0/${moved.length} done`);
    fireEvent.click(stop('next_year'));
    const withMoved = plan.targets.filter((t) => t.actions.some((a) => a.quarter === 'next_year'));
    expect(tree('Next year').querySelectorAll(':scope > li')).toHaveLength(withMoved.length);
  });

  it('has no Next-year stop for the v2.0 plan', async () => {
    mockFetch(fixturePlan());
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    expect(stop('next_year')).toBeNull();
  });
});

describe('timeline page — 4.2 plan', () => {
  /** Open O1 → the given detail's section in Q1 and click action `no`; returns the drawer. */
  async function openO1(no: number, section: string) {
    mockFetch(fixturePlanV42());
    renderApp('/?today=2026-10-01');
    await screen.findByLabelText('Timeline');
    fireEvent.click(folder(tree('Q1'), 'O1 '));
    fireEvent.click(folder(tree('Q1'), section));
    fireEvent.click(leaf('O1', no));
    return screen.getByRole('dialog', { name: 'Action detail' });
  }
  /** The drawer fact (dd) under the label `dt`. */
  const fact = (drawer: HTMLElement, dt: string) =>
    [...drawer.querySelectorAll('.drawer-facts dt')].find((d) => d.textContent === dt)
      ?.nextElementSibling?.textContent;
  const headings = (drawer: HTMLElement) =>
    [...drawer.querySelectorAll('.drawer-sec h3')].map((h) => h.textContent);

  it('shows partners, progress, detail, references and the full note for O1-2', async () => {
    const action = fixturePlanV42().targets[0].actions.find((a) => a.no === 2)!;
    const drawer = await openO1(2, '1.1 ');
    expect(fact(drawer, 'Partners')).toBe('BOD sponsor');
    expect(fact(drawer, 'Progress')).toBeDefined();
    expect(fact(drawer, 'Detail')).toBe('1.1 · AI strategy & roadmap approved');
    expect(fact(drawer, 'Section')).toBeUndefined();
    expect(fact(drawer, 'Weight')).toBe('17% of the year · equal');
    expect(headings(drawer)).toEqual([
      'Objective detail 1.1 · AI strategy & roadmap approved',
      'Reference documents',
      'Note',
      'Next for O1',
    ]);
    expect(drawer.textContent).toContain('Goal: One company AI strategy');
    expect(drawer.textContent).toContain('Needs first: BOD names a sponsor');
    expect(drawer.textContent).toContain('JD: 1.1, 1.2');
    expect(drawer.querySelectorAll('ul.drawer-refs li')).toHaveLength(3);
    expect(drawer.querySelector('p.drawer-note')!.textContent).toBe(action.note);
    expect(
      within(drawer).getByRole('link', { name: '▶ Open objective O1' }).getAttribute('href')
    ).toBe('/target/O1?today=2026-10-01');
  });

  it('leaves out empty sections and shows a blank % as counting 0 for O1-5', async () => {
    const drawer = await openO1(5, '1.2 ');
    expect(drawer.querySelector('.drawer-refs')).toBeNull();
    expect(drawer.querySelector('.drawer-note')).toBeNull();
    expect(fact(drawer, 'Progress')).toBe('— (counts as 0%)');
    expect(fact(drawer, 'Detail')).toBe('1.2 · Quarterly transformation review');
    expect(headings(drawer)).not.toContain('Deliverable');
    expect(headings(drawer)).not.toContain('Reference documents');
    expect(headings(drawer)).not.toContain('Note');
    expect(headings(drawer)[0]).toBe('Objective detail 1.2 · Quarterly transformation review');
  });

  it('says "objective", never "target", in the timeline and drawer copy', async () => {
    const drawer = await openO1(2, '1.1 ');
    const copy = [document.querySelector('main')!, drawer].map((e) => {
      const labels = [...e.querySelectorAll('[aria-label],[title]')].map(
        (x) => `${x.getAttribute('aria-label') ?? ''} ${x.getAttribute('title') ?? ''}`
      );
      return `${e.textContent ?? ''} ${labels.join(' ')}`;
    });
    expect(copy.join(' ').toLowerCase()).not.toContain('target');
  });
});

describe('timeline page — 2.x drawer', () => {
  it('keeps Section, Deliverable, Success measure and "Open target T1"', async () => {
    const plan = fixturePlan();
    mockFetch(plan);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    const nos = openFirstSection(plan, 'Q1', 'T1');
    const action = plan.targets[0].actions.find((a) => nos.includes(a.no) && a.measure)!;
    fireEvent.click(leaf('T1', action.no));
    const drawer = screen.getByRole('dialog', { name: 'Action detail' });
    const dts = [...drawer.querySelectorAll('.drawer-facts dt')].map((d) => d.textContent);
    expect(dts).toEqual(['Quarter', 'Due', 'Owner', 'Section', 'Weight']);
    const heads = [...drawer.querySelectorAll('.drawer-sec h3')].map((h) => h.textContent);
    expect(heads).toEqual(['Deliverable', 'Success measure', 'Next for T1']);
    expect(drawer.textContent).not.toContain('· equal');
    expect(within(drawer).getByRole('link', { name: '▶ Open target T1' })).toBeTruthy();
  });
});
