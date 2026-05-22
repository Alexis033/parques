import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home">
      <h1>Parchis Online</h1>
      <nav>
        <a routerLink="/lobby">Play</a>
        <a routerLink="/settings">Settings</a>
      </nav>
    </div>
  `,
  styles: [`
    .home { text-align: center; padding: 2rem; }
  `]
})
export class HomeComponent {}
