import { Routes } from '@angular/router';

// productONe
import { ProductOneComponent } from './productOne/productOne.component';


export const ProductOneRoutes: Routes = [
  {
    path: '',
    // children: [
    //   {
    //     path: 'product/:gtin',
        component: ProductOneComponent,
        
    //   },
    // ],
  },
];
