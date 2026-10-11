import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InstallPromptComponent } from './shared/install-prompt/install-prompt.component';

@Component({
  selector: 'cm-root',
  standalone: true,
  imports: [RouterOutlet, InstallPromptComponent],
  template: `
    <div class="cm-shell"><router-outlet></router-outlet></div>
    <cm-install-prompt />
  `,
})
export class AppComponent {}
