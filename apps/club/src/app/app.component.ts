import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InstallPromptComponent } from './shared/install-prompt/install-prompt.component';
import { BottomNavComponent } from './shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'cm-root',
  standalone: true,
  imports: [RouterOutlet, InstallPromptComponent, BottomNavComponent],
  template: `
    <div class="cm-shell"><router-outlet></router-outlet></div>
    <cm-install-prompt />
    <cm-bottom-nav />
  `,
})
export class AppComponent {}
