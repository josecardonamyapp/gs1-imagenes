import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ProductService } from 'src/app/services/product.service';

@Component({
  selector: 'app-dashboard1',
  standalone: true,
  imports: [
    TablerIconsModule,

  ],
  templateUrl: './dashboard1.component.html',
})
export class AppDashboard1Component {

  productos = [
    {
      nombre: '07503034029502',
      descripcion: 'CONTIENE LECHE Y SOYA. PUEDE CONTENER TRAZAS DE NUEZ, ALMENDRA Y GLUTEN (TRIGO).',
      precio: 59.99,
      imagen: 'https://gs1-api-images-public.s3.amazonaws.com/212c037d-f5e6-487e-9c46-2b9772bedb56.jpg'
    },
    {
      nombre: '07503034029496',
      descripcion: 'Monitor de ritmo cardíaco, resistencia al agua IP68 y sincronización con Android/iOS.',
      precio: 89.00,
      imagen: 'https://gs1-api-images-public.s3.amazonaws.com/03936d67-4ee6-4570-856c-db3466da6efe.jpg'
    },
    {
      nombre: '07503034029342',
      descripcion: 'Diseño escandinavo, luz cálida regulable y cargador USB integrado.',
      precio: 45.50,
      imagen: 'https://gs1-api-images-public.s3.amazonaws.com/fed4c643-80c6-461b-a7f9-27af212ac1d4.jpg'
    },
    {
      nombre: '07503034029359',
      descripcion: 'Diseño escandinavo, luz cálida regulable y cargador USB integrado.',
      precio: 45.50,
      imagen: 'https://gs1-api-images-public.s3.amazonaws.com/c041bfd2-c624-4846-88e1-712acadb523f.jpg'
    },
    {
      nombre: '07503034029151',
      descripcion: 'Diseño escandinavo, luz cálida regulable y cargador USB integrado.',
      precio: 45.50,
      imagen: 'https://gs1-api-images-public.s3.amazonaws.com/745b3dcf-9c87-4868-9f0a-0321fd017c10.jpg'
    }
  ];
  constructor(
    private productService: ProductService
  ) { }

  ngOnInit(): void {
    this.getPrductsAll();
  }

  async getPrductsAll() {
    this.productService.getAllProducts().subscribe({
      next: (result) => {
        console.log(result);
      }
    })
  }


}
