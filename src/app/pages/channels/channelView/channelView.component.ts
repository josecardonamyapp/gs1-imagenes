
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Channel } from 'src/app/model/channel';

@Component({
    selector: 'app-channelView',
    standalone: true,
    imports: [
        MatIconModule,
        CommonModule,
        FormsModule,
        MatTableModule,
        MatButtonModule,
        MatTooltipModule,
        MatFormFieldModule,
        MatInputModule
    ],
    templateUrl: './channelView.component.html',
    styleUrl: './channelView.component.scss'
})
export class ChannelViewComponent {
    channel = {} as Channel;
    constructor(
        private productService: ProductService,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            this.channel = params as Channel;
            console.log(params);   // '123'
        });
        // this.getProductChannels();
    }

    getPreviewStyle(format: any) {
        // this.selectedChannel = format;
        if (!format?.width || !format?.height) return {};

        const maxBoxSize = 200;
        const ratio = format.width / format.height;

        let width: number;
        let height: number;

        if (ratio >= 1) {
            width = maxBoxSize;
            height = Math.round(maxBoxSize / ratio);
        } else {
            height = maxBoxSize;
            width = Math.round(maxBoxSize * ratio);
        }

        return {
            width: `${width}px`,
            height: `${height}px`,
        };
    }
    // async getProductChannels() {
    //     this.productService.productGetChannels().subscribe({
    //         next: (result: any) => {
    //             if (typeof (result) === 'object') {
    //                 this.channels = new MatTableDataSource(result.channels);
    //             }
    //         }
    //     })
    // }

    onAction(action: string, row: any) {
        console.log('edito')
    }
}