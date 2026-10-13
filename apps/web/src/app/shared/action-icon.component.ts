import { Component, Input } from '@angular/core';

const paths = {
  calendar: ['M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 18h2'],
  menu: ['M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5'],
  pin: ['M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  phone: ['M5 3h4l2 5-3 2c1.5 3 3 4.5 6 6l2-3 5 2v4c0 1-1 2-2 2C10 21 3 14 3 5c0-1 1-2 2-2Z'],
  gift: ['M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H8a3 3 0 1 1 3-3l1 3Z M12 8h4a3 3 0 1 0-3-3l-1 3Z'],
  bag: ['M4 7h16l1 14H3L4 7Z M8 7V6a4 4 0 0 1 8 0v1'],
  mail: ['M3 5h18v14H3z M3 6l9 7 9-7'],
  clock: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M12 6v6l4 2'],
  arrow: ['M5 12h14 M14 7l5 5-5 5'],
  arrowDown: ['M12 4v16 M7 15l5 5 5-5'],
  refresh: ['M20 7V3l-4 4 M20 7A9 9 0 1 0 21 14'],
  // WhatsApp brand silhouette, Simple Icons (CC0); https://simpleicons.org/?q=whatsapp
  whatsapp: ['M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'],
} as const;
export type ActionIconName = keyof typeof paths;

@Component({
  selector: 'cm-action-icon', standalone: true,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    [attr.fill]="name === 'whatsapp' ? 'currentColor' : 'none'"
    [attr.stroke]="name === 'whatsapp' ? 'none' : 'currentColor'"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    @for (path of iconPaths; track $index) { <path [attr.d]="path" /> }
  </svg>`,
  styles: [':host{display:inline-flex;flex:0 0 auto;width:1.25em;height:1.25em;vertical-align:-.2em}svg{display:block;width:100%;height:100%}'],
})
export class ActionIconComponent {
  @Input() name: ActionIconName = 'arrow';
  protected get iconPaths(): readonly string[] { return paths[this.name]; }
}
