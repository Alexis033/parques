import { Component } from '@angular/core';

@Component({
  selector: 'app-board-goal',
  standalone: true,
  template: `<div class="goal"></div>`,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .goal {
      width: 0;
      height: 0;
      border-top: 105px solid #1D91FF;
      border-left: 105px solid #E84837;
      border-right: 105px solid #FBC71F;
      border-bottom: 105px solid #22CA57;
    }
  `],
})
export class BoardGoalComponent {}
