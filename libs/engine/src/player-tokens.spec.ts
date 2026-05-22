import { describe, it, expect } from 'vitest';
import { PlayerTokens } from './player-tokens';

describe('PlayerTokens', () => {
  it('should create 4 tokens in JAIL', () => {
    const pt = new PlayerTokens('RED');
    expect(pt.tokens.length).toBe(4);
    expect(pt.isAllHome()).toBe(true);
  });

  it('should move token to exit', () => {
    const pt = new PlayerTokens('RED');
    const moved = pt.moveToExit('r1');
    expect(pt.isAllHome()).toBe(true);
    expect(moved.isAllHome()).toBe(false);
    expect(moved.get(0).position).toBe(0);
    expect(moved.get(0).state).toBe('IN_TRANSIT');
  });

  it('should move token to jail', () => {
    const pt = new PlayerTokens('RED');
    const moved = pt.moveToExit('r1').moveToJail('r1');
    expect(moved.isAllHome()).toBe(true);
  });

  it('should crown token', () => {
    const pt = new PlayerTokens('RED');
    const moved = pt.crown('r1');
    expect(moved.get(0).isCrowned()).toBe(true);
    expect(moved.get(0).position).toBe(75);
  });

  it('should detect all crowned', () => {
    const pt = new PlayerTokens('RED');
    let moved = pt.crown('r1').crown('r2').crown('r3').crown('r4');
    expect(moved.isAllCrowned()).toBe(true);
  });

  it('should return active tokens', () => {
    const pt = new PlayerTokens('RED');
    let moved = pt.moveToExit('r1').moveToExit('r2');
    expect(moved.activeTokens().length).toBe(2);
    expect(moved.jailTokens().length).toBe(2);
  });

  it('should clone independently', () => {
    const pt = new PlayerTokens('RED');
    const cloned = pt.clone();
    const moved = pt.moveToExit('r1');
    expect(cloned.isAllHome()).toBe(true);
    expect(moved.isAllHome()).toBe(false);
  });

  it('should count tokens by state', () => {
    const pt = new PlayerTokens('RED');
    let moved = pt.crown('r1').moveToExit('r2');
    expect(moved.tokenCountInState('CROWNED')).toBe(1);
    expect(moved.tokenCountInState('IN_TRANSIT')).toBe(1);
    expect(moved.tokenCountInState('JAIL')).toBe(2);
  });

  it('should get token by id', () => {
    const pt = new PlayerTokens('BLUE');
    const token = pt.getById('b3');
    expect(token).toBeDefined();
    expect(token!.id).toBe('b3');
  });
});
