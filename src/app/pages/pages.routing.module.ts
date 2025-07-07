import { Routes } from '@angular/router';
import { StarterComponent } from './starter/starter.component';
import { ProductOneComponent } from './productOne/productOne/productOne.component';

export const PagesRoutes: Routes = [
  {
    path: '',
    component: StarterComponent,
    data: {
      title: 'Starter Page',
    },
  },

];
