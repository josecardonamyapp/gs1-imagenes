import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Home',
  },
  {
    displayName: 'Inicio',
    iconName: 'home',
    route: '/home',
  },
  {
    displayName: 'Canales de Venta',
    iconName: 'photo-cog',
    route: '/channels/channel'
  },
  {
    displayName: 'Mis procesamientos',
    iconName: 'file-search',
    route: '/jobs'
  }
];

