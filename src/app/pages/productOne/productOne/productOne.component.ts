import { Component, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProcessResultComponent } from '../productResult/productResult.component';
import { JobConfirmationComponent } from '../job-confirmation/job-confirmation.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Channel } from 'src/app/model/channel';

@Component({
    selector: 'app-productOne',
    standalone: true,
    imports: [
        MatIconModule,
        CommonModule,
        FormsModule,
        MatTabsModule,
        MatButton,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatSelectModule,
        MatInputModule,
        MatCheckboxModule,
        MatFormFieldModule,
        ProcessResultComponent
    ],
    templateUrl: './productOne.component.html',
    styleUrls: ['./productOne.component.scss']
})
export class ProductOneComponent {
    gtin: string | null = null;
    product: any = {
        gtin: '',
        producName: '',
        images: '',
        currentIndex: 0
    };
    channels: any[] = [];

    selectedFormat = 'Sams';
    imagesPerGtin = 1;

    selectedTab = 0;

    selectedImage: string | null = null;
    selectedChannel = {} as Channel;

    isGenerating = false;
    
    // Nuevas propiedades para IA
    useAIBackground = false;
    aiBackgroundPrompt = '';
    showAIMenu = false;
    aiImageDimensions = ['1024x1024', '768x768', '512x512'];
    aiImageDimensionsSelected = '1024x1024'; // Valor por defecto
    errorMessage = '';
    showError = false;

    constructor(
        private route: ActivatedRoute,
        private productService: ProductService,
        private router: Router,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.gtin = this.route.snapshot.paramMap.get('gtin');
        this.getPrductByGtin();
        this.getProductChannels();
        setTimeout(() => {
            this.getChannel({ value: this.channels[0]?.provider });
            this.getInitChannel({ value: this.channels[0]?.provider });
        }, 500);
    }

    goToReturn() {
        this.router.navigate(['/dashboards/dashboard1']);
    }

    async getPrductByGtin() {
        this.productService.productGetByGtin(this.gtin).subscribe({
            next: (result) => {
                if (typeof (result) === 'object') {

                    result.data.entities.attributes.map((element: any) => {

                        const files = Array.isArray(element?.referencedfileheader) ? element.referencedfileheader : [];

                        // Filtrar solo URLs que sean imágenes
                        const imageUrls = files.filter((file: any) => {
                            const url = file?.uniformresourceidentifier ?? '';
                            return typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                        });

                        const obj = {
                            gtin: element.gtin,
                            producName: element.tradeitemdescriptioninformation.descriptionshort,
                            images: imageUrls,
                            currentIndex: 0
                        }
                        // if (element.referencedfileheader != null) {
                        this.product = obj;
                        // }
                    });

                    // if (this.product?.images?.length > 0) {
                    //     this.selectedImage = this.product.images[0].uniformresourceidentifier;
                    // }
                    //(this.product);
                }
            }
        })
    }

    async getProductChannels() {
        this.productService.productGetChannels().subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = result.channels;
                }
            }
        })
    }

    getPreviewStyle(format: any, gln: any) {

        this.product["gln"] = gln;
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


    getInitChannel(event: any) {
        this.selectedChannel = this.channels.find(channel => channel.provider === event.value);
    }

    getChannel(event: any) {
        console.log('event', event)
        this.selectedChannel = this.channels.find(channel => channel.provider === event.value.provider);
    }

    toggleImage(url: string) {
        this.selectedImage = this.selectedImage === url ? null : url;
        console.log('img seleccionada', this.selectedImage)
    }

    processImg() {
        this.isGenerating = true;

        let productToSend;

        if (this.selectedImage) {
            const selectedImgObj = this.product.images.find(
                (img: any) => img.uniformresourceidentifier == this.selectedImage
            );

            productToSend = {
                ...this.product,
                images: selectedImgObj ? [selectedImgObj] : []
            };
        } else {
            productToSend = this.product;
        }

        const params = {
            images_url: productToSend,
            channel_params: this.selectedChannel
        }

        //(params)
        console.log('Processing image with channel:', params);
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                //(result)
                this.isGenerating = false;

                // Almacenar el job_id en localStorage
                if (result && result.job_id) {
                    const storedJobs = localStorage.getItem('processing_jobs');
                    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];

                    if (!jobIds.includes(result.job_id)) {
                        jobIds.push(result.job_id);
                        localStorage.setItem('processing_jobs', JSON.stringify(jobIds));
                    }
                }

                // Crear modal de confirmación para ir a ver los jobs
                const dialogRef = this.dialog.open(JobConfirmationComponent, {
                    data: result,
                    width: '500px',
                    disableClose: true
                });

                // Manejar la respuesta del modal
                dialogRef.afterClosed().subscribe(shouldRedirect => {
                    if (shouldRedirect) {
                        this.router.navigate(['/jobs']);
                    }
                });

            },
            error: (error) => {
                this.isGenerating = false;
                console.error('Error in processImg:', error);
            },
            complete: () => {
                this.isGenerating = false;
                //('processImg finished.');
            }
        })

    }

    processImgNoBackground() {
        this.isGenerating = true;

        let productToSend;

        if (this.selectedImage) {
            const selectedImgObj = this.product.images.find(
                (img: any) => img.uniformresourceidentifier == this.selectedImage
            );

            productToSend = {
                ...this.product,
                images: selectedImgObj ? [selectedImgObj] : []
            };
        } else {
            productToSend = this.product;
        }

        const params = {
            images_url: productToSend,
            channel_params: this.selectedChannel,
            no_background: true
        }

        console.log('Processing image with no background:', params);
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                //(result)
                this.isGenerating = false;

                // Almacenar el job_id en localStorage
                if (result && result.job_id) {
                    const storedJobs = localStorage.getItem('processing_jobs');
                    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];

                    if (!jobIds.includes(result.job_id)) {
                        jobIds.push(result.job_id);
                        localStorage.setItem('processing_jobs', JSON.stringify(jobIds));
                    }
                }

                // Crear modal de confirmación para ir a ver los jobs
                const dialogRef = this.dialog.open(JobConfirmationComponent, {
                    data: result,
                    width: '500px',
                    disableClose: true
                });

                // Manejar la respuesta del modal
                dialogRef.afterClosed().subscribe(shouldRedirect => {
                    if (shouldRedirect) {
                        this.router.navigate(['/jobs']);
                    }
                });

            },
            error: (error) => {
                this.isGenerating = false;
                console.error('Error in processImg:', error);
            },
            complete: () => {
                this.isGenerating = false;
                //('processImg finished.');
            }
        })

    }

    processImgWithAI() {
        if (!this.useAIBackground || !this.aiBackgroundPrompt.trim()) {
            this.showErrorMessage('Debe habilitar IA y proporcionar un prompt');
            return;
        }

        if (!this.selectedChannel || Object.keys(this.selectedChannel).length === 0) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar con IA');
            return;
        }

        this.isGenerating = true;
        this.hideError(); // Ocultar errores previos

        let productToSend;

        if (this.selectedImage) {
            const selectedImgObj = this.product.images.find(
                (img: any) => img.uniformresourceidentifier == this.selectedImage
            );

            productToSend = {
                ...this.product,
                images: selectedImgObj ? [selectedImgObj] : []
            };
        } else {
            productToSend = this.product;
        }

        // Parsear las dimensiones seleccionadas
        const [aiWidth, aiHeight] = this.aiImageDimensionsSelected.split('x').map(Number);
        
        // Crear channel_params con las dimensiones de IA si está habilitado
        const channelParams: any = {
            ...this.selectedChannel
        };

        channelParams.width = 1024;
        channelParams.height = 1024;
        channelParams.AI_background_prompt = this.aiBackgroundPrompt.trim();
        

        const params = {
            images_url: productToSend,
            channel_params: channelParams,
            AI_background_prompt: this.aiBackgroundPrompt.trim()
        }

        console.log('Processing image with AI background:', params);
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                this.isGenerating = false;

                // Almacenar el job_id en localStorage
                if (result && result.job_id) {
                    const storedJobs = localStorage.getItem('processing_jobs');
                    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];

                    if (!jobIds.includes(result.job_id)) {
                        jobIds.push(result.job_id);
                        localStorage.setItem('processing_jobs', JSON.stringify(jobIds));
                    }
                }

                // Crear modal de confirmación para ir a ver los jobs
                const dialogRef = this.dialog.open(JobConfirmationComponent, {
                    data: result,
                    width: '500px',
                    disableClose: true
                });

                // Manejar la respuesta del modal
                dialogRef.afterClosed().subscribe(shouldRedirect => {
                    if (shouldRedirect) {
                        this.router.navigate(['/jobs']);
                    }
                });

            },
            error: (error) => {
                this.isGenerating = false;
                this.showErrorMessage('Error al procesar la imagen con IA');
                console.error('Error in processImgWithAI:', error);
            },
            complete: () => {
                this.isGenerating = false;
            }
        })
    }

    showErrorMessage(message: string) {
        this.errorMessage = message;
        this.showError = true;
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        this.showError = false;
        this.errorMessage = '';
    }

    toggleAIMenu() {
        this.showAIMenu = !this.showAIMenu;
        if (!this.showAIMenu) {
            this.useAIBackground = false;
            this.aiBackgroundPrompt = '';
        }
    }

    onAICheckboxChange() {
        if (!this.useAIBackground) {
            this.aiBackgroundPrompt = '';
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        const target = event.target as HTMLElement;
        // No cerrar el menú si se hace clic en elementos del menú de IA
        if (!target.closest('.ai-button-container') && !target.closest('.ai-dropdown-menu')) {
            this.showAIMenu = false;
        }
    }
}
