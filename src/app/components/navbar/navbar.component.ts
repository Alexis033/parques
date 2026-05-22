import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="navbar">
      <a routerLink="/">Home</a>
      <a routerLink="/lobby">Play</a>
    </nav>
  `,
  styles: [``]
})
export class NavbarComponent {}
