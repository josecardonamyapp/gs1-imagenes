import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { ProductOneRoutes } from './productOne.routing';

// import { AppDashboard1Component } from './dashboard1/dashboard1.component';

@NgModule({
  imports: [
    RouterModule.forChild(ProductOneRoutes),
    // AppDashboard1Component,

  ],
})
export class ProductOneModule {}
