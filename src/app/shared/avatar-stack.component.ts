import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-avatar-stack',
  standalone: true,
  imports: [CommonModule, UserAvatarComponent],
  template: `
    <div class="flex items-center">
      <div class="flex -space-x-2">
        @for (uid of getVisibleUserIds(); track uid; let idx = $index) {
          <app-user-avatar
            [userId]="uid"
            [size]="size"
            [style.z-index]="userIds.length - idx"
            class="ring-2 ring-white rounded-full"
          ></app-user-avatar>
        }
      </div>
      @if (userIds.length > maxVisible) {
        <span class="text-xs font-semibold text-zinc-500 ml-2 font-sans">
          +{{ userIds.length - maxVisible }}
        </span>
      }
    </div>
  `
})
export class AvatarStackComponent {
  @Input() userIds: string[] = [];
  @Input() maxVisible = 4;
  @Input() size = 28;

  getVisibleUserIds(): string[] {
    return this.userIds.slice(0, this.maxVisible);
  }
}
