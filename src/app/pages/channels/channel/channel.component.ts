
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChannelRableSettings } from '../../../../assets/config/channelTable/channelTableSettings'

@Component({
    selector: 'app-channels',
    standalone: true,
    imports: [
        MatIconModule,
        CommonModule,
        MatTableModule,
        MatButtonModule,
        MatTooltipModule
    ],
    templateUrl: './channel.component.html',
    styleUrl: './channel.component.scss'
})
export class ChannelComponent {
    columns = ChannelRableSettings;
    displayedColumns = this.columns.map(c => c.key);
    channels = new MatTableDataSource<any>();

    constructor(
        private productService: ProductService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.getProductChannels();
    }

    async getProductChannels() {
        this.productService.productGetChannels().subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = new MatTableDataSource(result.channels);
                }
            }
        })
    }

    onAction(action: string, row: any) {
        console.log('edito', row)
        if (action === 'edit') {
            this.router.navigate(['/channels/view'], {
                queryParams: row
            });
        }
    }
}