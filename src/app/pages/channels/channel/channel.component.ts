
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ChannelRableSettings } from '../../../../assets/config/channelTable/channelTableSettings'

@Component({
    selector: 'app-channels',
    standalone: true,
    imports: [
        MatIconModule,
        CommonModule,
        MatTableModule,
        MatButtonModule,
        MatTooltipModule,
        MatSnackBarModule
    ],
    templateUrl: './channel.component.html',
    styleUrl: './channel.component.scss'
})
export class ChannelComponent {
    columns = ChannelRableSettings;
    displayedColumns = this.columns.map(c => c.key);
    channels = new MatTableDataSource<any>();
    isLoading = false;
    private isAdminUser = false;
    private userGln: string | null = null;

    constructor(
        private productService: ProductService,
        private router: Router,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.resolveUserAccess();
        this.getProductChannels();
    }

    private resolveUserAccess(): void {
        this.userGln = (localStorage.getItem('gln') || '').trim() || null;
        let roles: any[] = [];

        try {
            const storedRoles = JSON.parse(localStorage.getItem('roles') || '[]');
            roles = Array.isArray(storedRoles) ? storedRoles : [];
        } catch {
            roles = [];
        }

        this.isAdminUser = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('admin'))
        );
    }

    getProductChannels() {
        this.isLoading = true;
        const glnParam = !this.isAdminUser && this.userGln ? this.userGln : undefined;
        this.productService.productGetChannels(glnParam).subscribe({
            next: (result: any) => {
                this.isLoading = false;
                if (typeof (result) === 'object') {
                    this.channels = new MatTableDataSource(result.channels);
                }
            },
            error: (error) => {
                this.isLoading = false;
                this.showMessage('Error al cargar los canales');
                console.error('Error:', error);
            }
        })
    }

    onCreateNew() {
        this.router.navigate(['/channels/view']);
    }

    onAction(action: string, row: any) {
        //('Acción:', action, 'Fila:', row);
        
        if (action === 'edit') {
            this.router.navigate(['/channels/view'], {
                queryParams: row
            });
        }
    }

    private showMessage(message: string) {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000
        });
    }
}
