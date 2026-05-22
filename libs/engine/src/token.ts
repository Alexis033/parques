import { type PlayerColor, type BoardPosition, type TokenState } from '@parchis/shared';

export class Token {
  readonly id: string;
  readonly color: PlayerColor;
  readonly position: BoardPosition;
  readonly state: TokenState;

  constructor(id: string, color: PlayerColor) {
    this.id = id;
    this.color = color;
    this.position = -1 as BoardPosition;
    this.state = 'JAIL';
  }

  private static createFull(
    id: string,
    color: PlayerColor,
    position: BoardPosition,
    state: TokenState,
  ): Token {
    const t = new Token(id, color);
    (t as any).position = position;
    (t as any).state = state;
    return t;
  }

  withPosition(position: BoardPosition): Token {
    return Token.createFull(this.id, this.color, position, this.state);
  }

  withState(state: TokenState): Token {
    return Token.createFull(this.id, this.color, this.position, state);
  }

  withPositionAndState(position: BoardPosition, state: TokenState): Token {
    return Token.createFull(this.id, this.color, position, state);
  }

  isInJail(): boolean {
    return this.state === 'JAIL';
  }

  isInTransit(): boolean {
    return this.state === 'IN_TRANSIT';
  }

  isInSky(): boolean {
    return this.state === 'IN_SKY';
  }

  isCrowned(): boolean {
    return this.state === 'CROWNED';
  }

  clone(): Token {
    return Token.createFull(this.id, this.color, this.position, this.state);
  }
}
