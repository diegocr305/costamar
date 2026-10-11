import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'cm-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<div class="cm-shell"><router-outlet></router-outlet></div>`,
})
export class AppComponent {}
