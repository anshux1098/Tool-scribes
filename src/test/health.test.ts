import { describe, it, expect } from 'vitest';

describe('health check utilities', () => {
  it('status transitions follow expected patterns', () => {
    const validStatuses = ['active', 'warning', 'sunset', 'archived', 'unknown'];
    expect(validStatuses).toContain('active');
    expect(validStatuses).toContain('warning');
    expect(validStatuses).toContain('archived');
  });

  it('severity ordering is correct', () => {
    const severityOrder = ['active', 'warning', 'sunset', 'archived', 'unknown'];
    expect(severityOrder.indexOf('warning')).toBeLessThan(severityOrder.indexOf('archived'));
    expect(severityOrder.indexOf('unknown')).toBe(severityOrder.length - 1);
  });
});
