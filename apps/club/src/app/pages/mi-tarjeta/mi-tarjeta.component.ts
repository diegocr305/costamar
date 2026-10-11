import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MembershipStore } from '../../core/membership.store';

@Component({
  selector: 'cm-mi-tarjeta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mi-tarjeta.component.html',
  styleUrl: './mi-tarjeta.component.css',
})
export class MiTarjetaComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly store = inject(MembershipStore);

  ngOnInit(): void {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  protected levelLabel(level: string): string {
    const map: Record<string, string> = {
      bronce: 'Bronce',
      plata: 'Plata',
      oro: 'Oro',
    };
    return map[level] ?? level;
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.store.reset();
    await this.router.navigate(['/']);
  }
}
