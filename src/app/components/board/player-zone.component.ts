import { Component, input } from '@angular/core';
import type { PlayerColor } from '@parchis/shared';

@Component({
  selector: 'app-player-zone',
  standalone: true,
  template: `
    <div class="zone" [class]="'zone-' + color().toLowerCase()">
      <div class="inner">
        <div class="slot"></div>
        <div class="slot"></div>
        <div class="slot"></div>
        <div class="slot"></div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zone {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zone-red {
      border-bottom-left-radius: 15px;
    }
    .zone-blue {
      border-top-left-radius: 15px;
    }
    .zone-green {
      border-bottom-right-radius: 15px;
    }
    .zone-yellow {
      border-top-right-radius: 15px;
    }

    .inner {
      width: 205px;
      height: 205px;
      border-radius: 15px;
      display: grid;
      grid-template-columns: 50px 50px;
      grid-template-rows: 50px 50px;
      gap: 25px;
      place-content: center;
      box-shadow: rgba(50, 50, 93, 0.2) 0px 30px 60px -12px inset,
                  rgba(0, 0, 0, 0.2) 0px 18px 36px -18px inset;
    }
    .zone-red .inner    { background: #E84837; }
    .zone-blue .inner   { background: #1D91FF; }
    .zone-green .inner  { background: #22CA57; }
    .zone-yellow .inner { background: #FBC71F; }

    .slot {
      width: 50px;
      height: 50px;
      border-radius: 30px;
      box-shadow: rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset,
                  rgba(0, 0, 0, 0.1) 0px 18px 36px -18px inset;
      place-self: center;
    }
    .zone-red .slot    { background: #E84837; }
    .zone-blue .slot   { background: #1D91FF; }
    .zone-green .slot  { background: #22CA57; }
    .zone-yellow .slot { background: #FBC71F; }
  `],
})
export class PlayerZoneComponent {
  color = input.required<PlayerColor>();
}
