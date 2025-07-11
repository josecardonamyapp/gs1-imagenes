import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Home',
  },
  {
    displayName: 'Inicio',
    iconName: 'home',
    route: '/dashboards/dashboard1',
  },
  {
    displayName: 'Canales',
    iconName: 'photo-cog',
    route: '/channels/channel'
  }
];
