import { type PlayerColor, type BoardPosition, type TokenState } from '@parchis/shared';
import { Token } from './token';
import { EXIT_POSITIONS, CIELO_END } from './board';

export class PlayerTokens {
  readonly color: PlayerColor;
  readonly tokens: readonly Token[];

  constructor(color: PlayerColor) {
    this.color = color;
    const tokenIds = [
      `${color[0].toLowerCase()}1`,
      `${color[0].toLowerCase()}2`,
      `${color[0].toLowerCase()}3`,
      `${color[0].toLowerCase()}4`,
    ];
    this.tokens = tokenIds.map((id) => new Token(id, color));
  }

  private static create(color: PlayerColor, tokens: readonly Token[]): PlayerTokens {
    const pt = new PlayerTokens(color);
    (pt as any).tokens = tokens;
    return pt;
  }

  get(index: number): Token {
    return this.tokens[index];
  }

  getById(id: string): Token | undefined {
    return this.tokens.find((t) => t.id === id);
  }

  updateToken(tokenId: string, updater: (token: Token) => Token): PlayerTokens {
    const newTokens = this.tokens.map((t) =>
      t.id === tokenId ? updater(t) : t,
    );
    return PlayerTokens.create(this.color, newTokens);
  }

  moveToJail(tokenId: string): PlayerTokens {
    return this.updateToken(tokenId, (t) =>
      t.withPositionAndState(-1 as BoardPosition, 'JAIL'),
    );
  }

  moveToExit(tokenId: string): PlayerTokens {
    const exitPos = EXIT_POSITIONS[this.color];
    return this.updateToken(tokenId, (t) =>
      t.withPositionAndState(exitPos, 'IN_TRANSIT'),
    );
  }

  crown(tokenId: string): PlayerTokens {
    const crownPos = CIELO_END[this.color];
    return this.updateToken(tokenId, (t) =>
      t.withPositionAndState(crownPos, 'CROWNED'),
    );
  }

  isAllHome(): boolean {
    return this.tokens.every((t) => t.isInJail());
  }

  isAllCrowned(): boolean {
    return this.tokens.every((t) => t.isCrowned());
  }

  activeTokens(): Token[] {
    return this.tokens.filter(
      (t) => t.state === 'IN_TRANSIT' || t.state === 'IN_SKY',
    );
  }

  jailTokens(): Token[] {
    return this.tokens.filter((t) => t.isInJail());
  }

  crownedTokens(): Token[] {
    return this.tokens.filter((t) => t.isCrowned());
  }

  clone(): PlayerTokens {
    return PlayerTokens.create(
      this.color,
      this.tokens.map((t) => t.clone()),
    );
  }

  toArray(): Token[] {
    return [...this.tokens];
  }

  tokenCountInState(state: TokenState): number {
    return this.tokens.filter((t) => t.state === state).length;
  }
}
