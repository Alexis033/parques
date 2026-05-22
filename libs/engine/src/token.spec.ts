import { describe, it, expect } from 'vitest';
import { Token } from './token';

describe('Token', () => {
  it('should create a token in JAIL state', () => {
    const token = new Token('r1', 'RED');
    expect(token.id).toBe('r1');
    expect(token.color).toBe('RED');
    expect(token.isInJail()).toBe(true);
    expect(token.state).toBe('JAIL');
    expect(token.position).toBe(-1);
  });

  it('should update position immutably', () => {
    const token = new Token('r1', 'RED');
    const moved = token.withPosition(5);
    expect(token.position).toBe(-1);
    expect(moved.position).toBe(5);
    expect(moved.id).toBe('r1');
  });

  it('should update state immutably', () => {
    const token = new Token('r1', 'RED');
    const moved = token.withState('IN_TRANSIT');
    expect(token.state).toBe('JAIL');
    expect(moved.state).toBe('IN_TRANSIT');
  });

  it('should update both position and state', () => {
    const token = new Token('r1', 'RED');
    const moved = token.withPositionAndState(0, 'IN_TRANSIT');
    expect(moved.position).toBe(0);
    expect(moved.state).toBe('IN_TRANSIT');
  });

  it('should clone correctly', () => {
    const token = new Token('r1', 'RED');
    const moved = token.withPositionAndState(5, 'IN_TRANSIT');
    const cloned = moved.clone();
    expect(cloned.id).toBe('r1');
    expect(cloned.position).toBe(5);
    expect(cloned.state).toBe('IN_TRANSIT');
    expect(cloned.color).toBe('RED');
  });

  it('should detect states correctly', () => {
    const jail = new Token('r1', 'RED');
    expect(jail.isInJail()).toBe(true);

    const transit = jail.withState('IN_TRANSIT');
    expect(transit.isInTransit()).toBe(true);

    const sky = transit.withState('IN_SKY');
    expect(sky.isInSky()).toBe(true);

    const crowned = sky.withState('CROWNED');
    expect(crowned.isCrowned()).toBe(true);
  });
});
