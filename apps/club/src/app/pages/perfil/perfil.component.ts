import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ClubMemberPreferences } from '@costamar/shared';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ClubService } from '../../core/club.service';
import { MembershipStore } from '../../core/membership.store';

@Component({
  selector: 'cm-perfil',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly club = inject(ClubService);
  private readonly router = inject(Router);
  protected readonly store = inject(MembershipStore);

  protected savingPrefs = signal(false);
  protected prefsError = signal('');
  protected prefsSuccess = signal('');
  protected commune = '';
  protected visitType = '';
  protected foods: string[] = [];
  protected readonly foodOptions = [{value:'seafood',label:'🐟 Ceviches y mariscos'},{value:'hot_dishes',label:'🥩 Carnes y platos calientes'},{value:'drinks',label:'🍹 Jugos y cócteles'},{value:'desserts',label:'🍰 Postres'}];
  private hydrated = false;
  constructor() {
    effect(() => {
      const p=this.store.preferences();
      if(p && !this.hydrated) {this.commune=p.commune??'';this.visitType=p.visitType??'';this.foods=[...(p.foodPreferences??[])];this.hydrated=true;}
    });
  }
  protected toggleFood(value:string,checked:boolean):void {this.foods=checked?[...new Set([...this.foods,value])]:this.foods.filter(f=>f!==value);}
  protected async saveExperience():Promise<void> {await this.save({commune:this.commune.trim(),visitType:this.visitType,foodPreferences:this.foods});}

  ngOnInit(): void {
    if (!this.store.member()) {
      this.store.load();
    }
  }

  async toggleEmail(value: boolean): Promise<void> {
    await this.save({ marketingEmail: value });
  }

  async toggleWhatsapp(value: boolean): Promise<void> {
    await this.save({ marketingWhatsapp: value });
  }

  private async save(patch: Partial<ClubMemberPreferences>): Promise<void> {
    if(this.savingPrefs()) return;
    this.savingPrefs.set(true);
    this.prefsError.set('');this.prefsSuccess.set('');
    try {
      const updated = await firstValueFrom(this.club.updatePreferences(patch));
      this.store.preferences.set(updated);
      this.prefsSuccess.set('Tus preferencias se guardaron. Puedes cambiarlas cuando quieras.');
    } catch {
      this.prefsError.set('No pudimos guardar tus preferencias. Inténtalo nuevamente.');
    } finally {
      this.savingPrefs.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.store.reset();
    await this.router.navigate(['/']);
  }
}
