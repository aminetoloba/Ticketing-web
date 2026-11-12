import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth-service';
import { Role } from '../../core/models';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly auth = inject(AuthService);

  protected readonly roleLabels: Record<Role, string> = {
    Participant: 'Participant',
    Organizer: 'Organisateur',
    Staff: 'Staff',
    Admin: 'Administrateur',
  };

  protected logout(): void {
    this.auth.logout();
  }
}