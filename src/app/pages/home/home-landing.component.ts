import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DriverTourService } from 'src/app/core/tour/driver-tour.service';
@Component({
  selector: 'app-home-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './home-landing.component.html',
  styleUrls: ['./home-landing.component.scss'],
})
export class HomeLandingComponent {
  readonly dashboardRoute = '/dashboards/dashboard1';

  constructor(
    // private productService: ProductService,
    // private router: Router,
    // private snackBar: MatSnackBar,
    private tourService: DriverTourService,
    // private catalogService: CatalogService
  ) { }

  @ViewChild('toolbar') toolbarRef?: ElementRef<HTMLDivElement>;
  @ViewChild('toolbarToggle', { static: true }) toolbarToggleRef?: ElementRef<HTMLButtonElement>;
  tourByRoute: Record<string, any[]> = {
    '/home': [
      {
        element: '#menu-inicio',
        popover: {
          title: 'Inicio',
          description: 'Accede al panel principal para comenzar a gestionar tus productos y actividades.'
        }
      },
      {
        element: '#home-landing',
        popover: {
          title: 'Selección de opciones',
          description: 'Selecciona la opción que deseas procesar.'
        },
        allowInteraction: true
      },
    ],
    '/dashboards/dashboard1': [
      {
        element: '#input-gtin',
        popover: {
          title: 'Buscar productos',
          description: 'Ingresa el nombre del producto o su código GTIN para realizar una búsqueda directa.'
        },
        allowInteraction: true
      },
      {
        element: '#btn-seleccionar-todos',
        popover: {
          title: 'Seleccionar todos los productos',
          description: 'Haz clic aquí para seleccionar rápidamente todos los productos mostrados.'
        }
      },
      // {
      //   element: '#btn-buscar-gtins',
      //   popover: {
      //     title: 'Búsqueda por lista de GTINs',
      //     description: 'Importa una lista con múltiples GTINs para realizar una búsqueda masiva.'
      //   }
      // },
      {
        element: '#tarjeta-producto-1',
        popover: {
          title: 'Vista de productos',
          description: 'Acá se mostrará la información de los productos seleccionados al realizar una búsqueda.'
        }
      },
      // {
      //   element: '#carousel-imagenes',
      //   popover: {
      //     title: 'Carrusel de imágenes',
      //     description: 'Desplázate entre las imágenes disponibles del producto para visualizar sus distintas vistas.'
      //   }
      // },
      // {
      //   element: '#informacion-tarjeta',
      //   popover: {
      //     title: 'Detalles del producto',
      //     description: 'Consulta aquí detalles adicionales como imágenes, descripciones y opciones de procesamiento.'
      //   }
      // }
    ],
    '/channels/channel': [
      {
        element: '#menu-canales-de-venta',
        popover: {
          title: 'Gestión de Canales de Venta',
          description: 'Administra tus canales de distribución desde esta sección.'
        }
      },
      {
        element: '#lista-canales',
        popover: {
          title: 'Listado de canales',
          description: 'Visualiza todos los canales existentes configurados en la plataforma.'
        }
      },
      {
        element: '#crear-canal',
        popover: {
          title: 'Crear un nuevo canal',
          description: 'Haz clic aquí para configurar un nuevo canal de distribución.'
        }
      },
      {
        element: '#editar-canal',
        popover: {
          title: 'Editar canal existente',
          description: 'Modifica la configuración de un canal ya existente desde esta opción.'
        }
      }
    ],
    '/jobs': [
      {
        element: '#menu-mis-procesamientos',
        popover: {
          title: 'Mis Procesamientos',
          description: 'Consulta todas las solicitudes de procesamiento realizadas hasta ahora.'
        }
      },
      {
        element: '#lista-procesamientos',
        popover: {
          title: 'Lista de procesamientos',
          description: 'Aquí se muestra un historial detallado de todos tus trabajos procesados.'
        }
      },
      {
        element: '#actualizar-procesamientos',
        popover: {
          title: 'Actualizar lista',
          description: 'Refresca el listado para ver el estado más reciente de tus procesamientos.'
        }
      },
      {
        element: '#procesar-productos',
        popover: {
          title: 'Nuevo procesamiento',
          description: 'Inicia un nuevo procesamiento a partir de tu lista de productos seleccionados.'
        }
      }
    ]
  };


  tourSequence: string[] = [
    '/home',
    '/dashboards/dashboard1',
    '/channels/channel',
    '/jobs'
  ];

  ngAfterViewInit() {

    const userId = 'usuario';
    const tourKey = 'dashboard';

    this.tourService.startMultiPageTour(userId, tourKey, this.tourSequence, this.tourByRoute);
  }
}
