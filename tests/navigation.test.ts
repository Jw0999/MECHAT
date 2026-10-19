import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Navigation Integrity & Status Removal', () => {
  it('strictly verifies primary navigation contains all 5 sections including Games', () => {
    const bottomNavCode = fs.readFileSync(
      path.resolve(__dirname, '../src/features/shell/BottomNav.tsx'),
      'utf-8'
    );

    // Verify all 5 nav items
    expect(bottomNavCode).toContain("id: 'calling'");
    expect(bottomNavCode).toContain("id: 'chat'");
    expect(bottomNavCode).toContain("id: 'groups'");
    expect(bottomNavCode).toContain("id: 'games'");
    expect(bottomNavCode).toContain("id: 'settings'");

    // Strictly ensure 'status' is NOT in the nav items
    expect(bottomNavCode).not.toContain("id: 'status'");
    expect(bottomNavCode).not.toContain("label: 'Status'");
    expect(bottomNavCode).not.toContain("label: 'status'");
  });

  it('strictly verifies DesktopSidebar contains no status navigation', () => {
    const desktopSidebarCode = fs.readFileSync(
      path.resolve(__dirname, '../src/features/shell/DesktopSidebar.tsx'),
      'utf-8'
    );

    expect(desktopSidebarCode).not.toContain("id: 'status'");
    expect(desktopSidebarCode).not.toContain("label: 'Status'");
  });

  it('strictly verifies no Status screen or Status tab file exists in src', () => {
    const files = fs.readdirSync(path.resolve(__dirname, '../src/features/chat'));
    const statusFiles = files.filter((f) => f.toLowerCase().includes('status'));
    expect(statusFiles.length).toBe(0);
  });
});
